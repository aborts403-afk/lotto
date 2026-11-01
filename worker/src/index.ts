// lotto-note Worker: serves the Expo web build (static assets) and the /api/* routes,
// and collects new draw results on a cron schedule (see `triggers` in wrangler.jsonc).
import {
  getMeta,
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

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

// Max lookups per run; each lookup can return several rounds, so this also covers multi-week gaps.
const MAX_LOOKUPS_PER_RUN = 5;
// Winning-store lists can appear later than the numbers, so recent rounds are re-checked until
// the number of store rows matches the 1st/2nd prize winner counts.
const STORE_SYNC_RECENT_ROUNDS = 4;

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

async function handleApi(url: URL, env: Env): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/api/latest') {
    const row = await env.DB.prepare('SELECT * FROM draws ORDER BY round DESC LIMIT 1').first<DrawRow>();
    return row ? json(toApi(row), { maxAge: 300 }) : json({ error: 'no data' }, { status: 404 });
  }

  if (path === '/api/draws') {
    const limitParam = Number(url.searchParams.get('limit'));
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : -1; // -1 = all
    const { results } = await env.DB.prepare('SELECT * FROM draws ORDER BY round DESC LIMIT ?')
      .bind(limit)
      .all<DrawRow>();
    return json(results.map(toApi), { maxAge: 300 });
  }

  const one = path.match(/^\/api\/draws\/(\d+)$/);
  if (one) {
    const row = await env.DB.prepare('SELECT * FROM draws WHERE round = ?').bind(Number(one[1])).first<DrawRow>();
    return row ? json(toApi(row), { maxAge: 3600 }) : json({ error: 'not found' }, { status: 404 });
  }

  const stores = path.match(/^\/api\/draws\/(\d+)\/stores$/);
  if (stores) {
    const { results } = await env.DB.prepare(
      `SELECT round, rank, seq, store_id, store_name, address, region, pick_type, lat, lng, phone, status
         FROM winning_tickets WHERE round = ? ORDER BY rank, seq`,
    )
      .bind(Number(stores[1]))
      .all<TicketRow>();
    return json(results.map(ticketToApi), { maxAge: 3600 });
  }

  if (path === '/api/health') {
    const row = await env.DB.prepare('SELECT round, draw_date FROM draws ORDER BY round DESC LIMIT 1')
      .first<{ round: number; draw_date: string }>();
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
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET' } });
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 });
      try {
        return await handleApi(url, env);
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
