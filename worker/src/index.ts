// lotto-note Worker: serves the Expo web build (static assets) and the /api/* routes,
// and collects new draw results on a cron schedule (see `triggers` in wrangler.jsonc).
import {
  getMeta,
  getMetaValue,
  STORES_SUMMARY_KEY,
  latestRound,
  replaceTicketsStmts,
  setMeta,
  ticketToApi,
  toApi,
  upsertDrawStmt,
  type DrawRow,
  type TicketRow,
} from './db';
import { fetchAround, fetchWinningTickets, FIRST_ROUND_WITH_STORES, unknownKeysSeen } from './dhlottery';
import { storesSummary } from './stores';

// Build-time bulk export of winning tickets, in fixed blocks of rounds so the cache keys stay bounded.
const TICKET_BLOCK = 100;

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

// Max lookups per run; each lookup can return several rounds, so this also covers multi-week gaps.
const MAX_LOOKUPS_PER_RUN = 5;
// Winning-store lists can appear later than the numbers, so recent rounds are re-checked until
// the number of store rows matches the 1st/2nd prize winner counts.
const STORE_SYNC_RECENT_ROUNDS = 4;
// Older rounds are final: their store lists are cached for a day and bundled as static files at build time.

async function syncRecentStores(env: Env): Promise<number[]> {
  const { results } = await env.DB.prepare(
    `SELECT d.round,
            d.rank1_winners AS w1, (SELECT COUNT(*) FROM winning_tickets t WHERE t.round = d.round AND t.rank = 1) AS t1,
            d.rank2_winners AS w2, (SELECT COUNT(*) FROM winning_tickets t WHERE t.round = d.round AND t.rank = 2) AS t2
       FROM draws d WHERE d.round >= ? ORDER BY d.round DESC LIMIT ?`,
  )
    .bind(FIRST_ROUND_WITH_STORES, STORE_SYNC_RECENT_ROUNDS)
    .all<{ round: number; w1: number; t1: number; w2: number; t2: number }>();
  const synced: number[] = [];
  for (const r of results) {
    if (r.w1 === r.t1 && r.w2 === r.t2) continue;
    for (const rank of [1, 2] as const) {
      const tickets = await fetchWinningTickets(r.round, rank);
      if (tickets.length === 0) continue; // not published yet; keep what we have
      await env.DB.batch(replaceTicketsStmts(env.DB, r.round, rank, tickets));
    }
    synced.push(r.round);
  }
  return synced;
}

async function refreshStoresSummary(db: D1Database): Promise<string> {
  const summary = JSON.stringify(await storesSummary(db));
  await setMeta(db, STORES_SUMMARY_KEY, summary);
  return summary;
}

export async function collect(env: Env): Promise<{ added: number[]; storesSynced: number[] }> {
  const added: number[] = [];
  const now = new Date().toISOString();
  await setMeta(env.DB, 'last_run_at', now);
  try {
    let latest = await latestRound(env.DB);
    for (let i = 0; i < MAX_LOOKUPS_PER_RUN; i++) {
      const fresh = (await fetchAround(latest + 1)).filter((d) => d.round > latest);
      if (fresh.length === 0) break;
      await env.DB.batch(fresh.map((d) => upsertDrawStmt(env.DB, d)));
      added.push(...fresh.map((d) => d.round));
      latest = Math.max(...fresh.map((d) => d.round));
    }
    const storesSynced = await syncRecentStores(env);
    // The store ranking reads every winning ticket (~200k rows), so it is computed here, only when the
    // stores changed, and served from meta.
    if (storesSynced.length || !(await getMetaValue(env.DB, STORES_SUMMARY_KEY))) await refreshStoresSummary(env.DB);
    await setMeta(env.DB, 'last_success_at', now);
    await setMeta(env.DB, 'last_error', '');
    added.sort((a, b) => a - b);
    if (added.length) await setMeta(env.DB, 'last_added', added.join(','));
    if (storesSynced.length) await setMeta(env.DB, 'last_stores_synced', `${now} ${storesSynced.join(',')}`);
    if (unknownKeysSeen.size) {
      await setMeta(env.DB, 'unknown_fields', [...unknownKeysSeen].sort().join(','));
      console.warn(JSON.stringify({ event: 'unknown_fields', fields: [...unknownKeysSeen] }));
    }
    console.log(JSON.stringify({ event: 'collect', added, storesSynced }));
    return { added, storesSynced };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setMeta(env.DB, 'last_error', `${now} ${message}`);
    console.error(JSON.stringify({ event: 'collect_failed', message }));
    throw err;
  }
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

// `maxAge` is both the browser cache time and how long the response stays in the Cloudflare edge cache
// (see fetch below); 0 = not cached.
function json(data: unknown, init: { status?: number; maxAge?: number } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': init.maxAge ? `public, max-age=${init.maxAge}` : 'no-store',
      ...CORS,
    },
  });
}

function rawJson(body: string, maxAge: number): Response {
  return new Response(body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}`, ...CORS },
  });
}

const DAY = 86_400;

// /api/draws?limit=N: the app asks for "rounds since my bundle" (a handful), the build for all of them.
// Limits are rounded up to a few sizes so that arbitrary values cannot each miss the cache.
const LIMIT_BUCKETS = [10, 60, 520];
function bucketLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return -1; // all
  return LIMIT_BUCKETS.find((b) => n <= b) ?? -1;
}

// Cache key for a request: path plus only the query parameters a route actually uses (normalized).
function cacheKey(url: URL): string {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/draws') return `${url.origin}${path}?limit=${bucketLimit(url.searchParams.get('limit'))}`;
  return `${url.origin}${path}`;
}

async function handleApi(url: URL, env: Env): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/api/latest') {
    const row = await env.DB.prepare('SELECT * FROM draws ORDER BY round DESC LIMIT 1').first<DrawRow>();
    return row ? json(toApi(row), { maxAge: 300 }) : json({ error: 'no data' }, { status: 404 });
  }

  if (path === '/api/draws') {
    const limit = bucketLimit(url.searchParams.get('limit'));
    const { results } = await env.DB.prepare('SELECT * FROM draws ORDER BY round DESC LIMIT ?').bind(limit).all<DrawRow>();
    return json(results.map(toApi), { maxAge: 300 });
  }

  const one = path.match(/^\/api\/draws\/(\d+)$/);
  if (one) {
    const row = await env.DB.prepare('SELECT * FROM draws WHERE round = ?').bind(Number(one[1])).first<DrawRow>();
    return row ? json(toApi(row), { maxAge: 3600 }) : json({ error: 'not found' }, { status: 404 });
  }

  const stores = path.match(/^\/api\/draws\/(\d+)\/stores$/);
  if (stores) {
    const round = Number(stores[1]);
    const { results } = await env.DB.prepare(
      `SELECT round, rank, seq, store_id, store_name, address, region, pick_type, lat, lng, phone, status
         FROM winning_tickets WHERE round = ? ORDER BY rank, seq`,
    )
      .bind(round)
      .all<TicketRow>();
    const final = round <= (await latestRound(env.DB)) - STORE_SYNC_RECENT_ROUNDS;
    return json(results.map(ticketToApi), { maxAge: final ? DAY : 600 });
  }

  // For the web build: every winning ticket in rounds [block*100, block*100+99], written to static files.
  const block = path.match(/^\/api\/stores\/tickets\/(\d+)$/);
  if (block) {
    const from = Number(block[1]) * TICKET_BLOCK;
    const { results } = await env.DB.prepare(
      `SELECT round, rank, seq, store_id, store_name, address, region, pick_type, lat, lng, phone, status
         FROM winning_tickets WHERE round BETWEEN ? AND ? ORDER BY round, rank, seq`,
    )
      .bind(from, from + TICKET_BLOCK - 1)
      .all<TicketRow>();
    const final = from + TICKET_BLOCK - 1 <= (await latestRound(env.DB)) - STORE_SYNC_RECENT_ROUNDS;
    return json(
      results.map((t) => ({ round: t.round, ...ticketToApi(t) })),
      { maxAge: final ? DAY : 600 },
    );
  }

  if (path === '/api/stores/summary') {
    // Precomputed by the cron (refreshStoresSummary); computed here only if it has never run.
    const cached = (await getMetaValue(env.DB, STORES_SUMMARY_KEY)) ?? (await refreshStoresSummary(env.DB));
    return rawJson(cached, 3600);
  }

  if (path === '/api/health') {
    const row = await env.DB.prepare('SELECT round, draw_date FROM draws ORDER BY round DESC LIMIT 1').first<{
      round: number;
      draw_date: string;
    }>();
    const meta = await getMeta(env.DB);
    // Draws are weekly; more than 8 days since the latest stored draw means collection is behind.
    const daysSince = row ? (Date.now() - Date.parse(`${row.draw_date}T20:45:00+09:00`)) / 86_400_000 : Infinity;
    const stale = daysSince > 8;
    return json(
      { ok: !stale && !meta.last_error, stale, latestRound: row?.round ?? null, latestDrawDate: row?.draw_date ?? null, ...meta },
      { status: stale ? 503 : 200 },
    );
  }

  return json({ error: 'not found' }, { status: 404 });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS')
        return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 });
      // Edge cache (per Cloudflare data center): repeated requests are answered without touching D1.
      // Only successful responses with a max-age are stored; /api/health is never cached (no-store).
      const cache = caches.default;
      const key = new Request(cacheKey(url));
      const hit = await cache.match(key);
      if (hit) return hit;
      try {
        const res = await handleApi(url, env);
        if (res.ok && res.headers.get('Cache-Control')?.includes('max-age')) ctx.waitUntil(cache.put(key, res.clone()));
        return res;
      } catch (err) {
        console.error(err);
        return json({ error: 'internal error' }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(collect(env));
  },
} satisfies ExportedHandler<Env>;
