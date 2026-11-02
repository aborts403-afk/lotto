// Pull all draws from the API and write the build-time data the app and static pages use:
//   - src/data/draws.json   compact rows, bundled into the app (web pages render with real content)
//   - src/data/stores.json  winning-store rankings (/api/stores/summary)
//   - public/data/stores/<round>.json  winning stores of each finalized round (served as static files,
//     so viewing them does not use the Worker or D1; the app fetches recent rounds from the API)
//   - public/sitemap.xml    every page, for search engines
//   - public/robots.txt
// Runs before every web build (npm run build:web).
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SITE_URL } from '../src/lib/site';

type ApiDraw = {
  round: number;
  drawDate: string;
  numbers: number[];
  bonus: number;
  ranks: { rank: number; winners: number; prize: number }[];
  totalSales: number;
  firstPrizePickTypes: { auto: number; manual: number; semiAuto: number } | null;
};

const root = resolve(import.meta.dirname, '..');
// API_BASE=http://localhost:8787 to build from `wrangler dev` instead of production.
const API_BASE = process.env.API_BASE ?? SITE_URL;
const res = await fetch(`${API_BASE}/api/draws`, { headers: { 'User-Agent': 'lotto-note-build' } });
if (!res.ok) throw new Error(`GET /api/draws failed: HTTP ${res.status}`);
const draws = ((await res.json()) as ApiDraw[]).sort((a, b) => a.round - b.round);
if (draws.length === 0 || draws[draws.length - 1].round !== draws.length) {
  throw new Error(`unexpected draws: ${draws.length} rows, last round ${draws.at(-1)?.round}`);
}

// Row layout is documented in src/lib/lotto/draws.ts (decodeRow).
const rows = draws.map((d) => [
  d.round,
  d.drawDate,
  ...d.numbers,
  d.bonus,
  ...d.ranks.flatMap((r) => [r.winners, r.prize]),
  d.totalSales,
  d.firstPrizePickTypes?.auto ?? null,
  d.firstPrizePickTypes?.manual ?? null,
  d.firstPrizePickTypes?.semiAuto ?? null,
]);
writeFileSync(resolve(root, 'src/data/draws.json'), `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);

// Winning stores. If the endpoint is unavailable (e.g. the Worker that serves it is not deployed yet),
// keep the committed file rather than failing the whole build.
const storesFile = resolve(root, 'src/data/stores.json');
const storesRes = await fetch(`${API_BASE}/api/stores/summary`, { headers: { 'User-Agent': 'lotto-note-build' } });
if (storesRes.ok) {
  writeFileSync(storesFile, `${JSON.stringify(await storesRes.json())}\n`);
} else if (existsSync(storesFile)) {
  console.warn(`GET /api/stores/summary failed (HTTP ${storesRes.status}); keeping the existing src/data/stores.json`);
} else {
  throw new Error(`GET /api/stores/summary failed: HTTP ${storesRes.status}`);
}

// Static winning-store files. Rounds whose lists the cron may still update (the last STORE_RECENT_ROUNDS)
// are left to the API. Keep in sync with STORE_SYNC_RECENT_ROUNDS (worker) and STATIC_STORES_THROUGH (app).
const FIRST_ROUND_WITH_STORES = 262;
const STORE_RECENT_ROUNDS = 4;
const TICKET_BLOCK = 100;
const lastFinal = draws[draws.length - 1].round - STORE_RECENT_ROUNDS;
const storesDir = resolve(root, 'public/data/stores');
type Ticket = { round: number; phone?: unknown; [k: string]: unknown };
const byRound = new Map<number, Ticket[]>();
let blocksOk = true;
for (let b = Math.floor(FIRST_ROUND_WITH_STORES / TICKET_BLOCK); b <= Math.floor(lastFinal / TICKET_BLOCK); b++) {
  const r = await fetch(`${API_BASE}/api/stores/tickets/${b}`, { headers: { 'User-Agent': 'lotto-note-build' } });
  if (!r.ok) {
    blocksOk = false;
    break;
  }
  for (const t of (await r.json()) as Ticket[]) byRound.set(t.round, [...(byRound.get(t.round) ?? []), t]);
}
if (blocksOk) {
  rmSync(storesDir, { recursive: true, force: true });
  mkdirSync(storesDir, { recursive: true });
  for (let round = FIRST_ROUND_WITH_STORES; round <= lastFinal; round++) {
    // Same shape as /api/draws/:round/stores, minus fields the app does not show.
    const tickets = (byRound.get(round) ?? []).map(({ round: _r, phone: _p, ...t }) => t);
    writeFileSync(resolve(storesDir, `${round}.json`), JSON.stringify(tickets));
  }
  console.log(`wrote static store files for rounds ${FIRST_ROUND_WITH_STORES}~${lastFinal}`);
} else {
  // The Worker serving the bulk export is not deployed yet: the app falls back to the API for every round.
  console.warn('GET /api/stores/tickets failed; skipping static store files (the app will use the API)');
}

const latest = draws[draws.length - 1];
const urls = [
  { loc: '/', lastmod: latest.drawDate, priority: '1.0' },
  { loc: '/round', lastmod: latest.drawDate, priority: '0.9' },
  { loc: '/generate', priority: '0.8' },
  { loc: '/my', priority: '0.8' },
  { loc: '/diagnose', priority: '0.9' },
  { loc: '/stats/simulator', priority: '0.8' },
  { loc: '/stats', lastmod: latest.drawDate, priority: '0.8' },
  { loc: '/stats/stores', lastmod: latest.drawDate, priority: '0.7' },
  ...Array.from({ length: 45 }, (_, i) => ({ loc: `/stats/${i + 1}`, lastmod: latest.drawDate, priority: '0.6' })),
  ...draws
    .slice()
    .reverse()
    .map((d) => ({ loc: `/round/${d.round}`, lastmod: d.drawDate, priority: d.round === latest.round ? '0.9' : '0.6' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${SITE_URL}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;
writeFileSync(resolve(root, 'public/sitemap.xml'), sitemap);
writeFileSync(
  resolve(root, 'public/robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);

console.log(`synced ${draws.length} draws (latest ${latest.round}, ${latest.drawDate}), sitemap ${urls.length} urls`);
