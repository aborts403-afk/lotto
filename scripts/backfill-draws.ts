// One-time backfill: fetch every past draw and write SQL for D1.
//   node scripts/backfill-draws.ts > worker/backfill.sql
//   npx wrangler d1 execute lotto-db --remote --file worker/backfill.sql
// Weekly updates after this are done by the Worker cron. Re-running overwrites existing rows (INSERT OR REPLACE).
import { fetchAround, type Draw } from '../worker/src/dhlottery.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const draws = new Map<number, Draw>();

// center=N returns about N-5..N+4, so step by 10 starting at 6 to cover 1..10, 11..20, ...
for (let center = 6; ; center += 10) {
  const batch = await fetchAround(center);
  batch.forEach((d) => draws.set(d.round, d));
  process.stderr.write(`\rfetched ${draws.size} draws (center ${center})`);
  if (!batch.some((d) => d.round >= center)) break; // reached the latest drawn round
  await sleep(300); // be gentle with the source
}

const rounds = [...draws.keys()].sort((a, b) => a - b);
const max = rounds[rounds.length - 1];
const missing = Array.from({ length: max }, (_, i) => i + 1).filter((r) => !draws.has(r));
process.stderr.write(`\nlatest round ${max}, missing: ${missing.length ? missing.join(',') : 'none'}\n`);
if (missing.length) process.exit(1);

const q = (v: string | number) => (typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
for (const r of rounds) {
  const d = draws.get(r)!;
  const values = [d.round, d.drawDate, ...d.numbers, d.bonus, ...d.ranks.flatMap((x) => [x.winners, x.prize]), d.totalSales];
  console.log(
    `INSERT OR REPLACE INTO draws (round, draw_date, n1, n2, n3, n4, n5, n6, bonus, rank1_winners, rank1_prize, rank2_winners, rank2_prize, rank3_winners, rank3_prize, rank4_winners, rank4_prize, rank5_winners, rank5_prize, total_sales) VALUES (${values.map(q).join(', ')});`,
  );
}
