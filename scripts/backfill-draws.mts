// Backfill every past draw (all API fields) as SQL for D1. Re-running overwrites rows.
//   npx tsx scripts/backfill-draws.mts > worker/backfill.sql
//   npx wrangler d1 execute lotto-db --remote --file worker/backfill.sql
// Weekly updates after this are done by the Worker cron.
import { DRAW_COLUMNS, drawValues } from '../worker/src/db';
import { fetchAround, unknownKeysSeen, type Draw } from '../worker/src/dhlottery';
import { insertSql } from './sql.mts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const draws = new Map<number, Draw>();

// center=N returns about N-5..N+4, so step by 10 starting at 6 to cover 1..10, 11..20, ...
for (let center = 6; ; center += 10) {
  const batch = await fetchAround(center);
  batch.forEach((d) => draws.set(d.round, d));
  process.stderr.write(`\rfetched ${draws.size} draws`);
  if (!batch.some((d) => d.round >= center)) break; // reached the latest drawn round
  await sleep(300); // be gentle with the source
}

const rounds = [...draws.keys()].sort((a, b) => a - b);
const max = rounds[rounds.length - 1];
const missing = Array.from({ length: max }, (_, i) => i + 1).filter((r) => !draws.has(r));
process.stderr.write(`\nlatest round ${max}, missing: ${missing.length ? missing.join(',') : 'none'}\n`);
if (missing.length) process.exit(1);
if (unknownKeysSeen.size) {
  process.stderr.write(`unmapped API fields: ${[...unknownKeysSeen].join(', ')} — add them to worker/src/dhlottery.ts\n`);
  process.exit(1);
}

for (const r of rounds) console.log(insertSql('INSERT OR REPLACE', 'draws', DRAW_COLUMNS, drawValues(draws.get(r)!)));
