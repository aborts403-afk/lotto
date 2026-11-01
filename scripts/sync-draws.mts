// Pull all draws from the API and write the build-time data the app and static pages use:
//   - src/data/draws.json   compact rows, bundled into the app (web pages render with real content)
//   - public/sitemap.xml    every page, for search engines
//   - public/robots.txt
// Runs before every web build (npm run build:web).
import { writeFileSync } from 'node:fs';
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
const res = await fetch(`${SITE_URL}/api/draws`, { headers: { 'User-Agent': 'lotto-note-build' } });
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

const latest = draws[draws.length - 1];
const urls = [
  { loc: '/', lastmod: latest.drawDate, priority: '1.0' },
  { loc: '/round', lastmod: latest.drawDate, priority: '0.9' },
  { loc: '/generate', priority: '0.8' },
  { loc: '/stats', lastmod: latest.drawDate, priority: '0.8' },
  ...draws
    .slice()
    .reverse()
    .map((d) => ({ loc: `/round/${d.round}`, lastmod: d.drawDate, priority: d.round === latest.round ? '0.9' : '0.6' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${SITE_URL}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
  .join('\n')}
</urlset>
`;
writeFileSync(resolve(root, 'public/sitemap.xml'), sitemap);
writeFileSync(resolve(root, 'public/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`synced ${draws.length} draws (latest ${latest.round}, ${latest.drawDate}), sitemap ${urls.length} urls`);
