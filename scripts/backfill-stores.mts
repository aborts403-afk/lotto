// Backfill 1st/2nd prize winning tickets (stores) for every round since 262 as SQL for D1.
//   npx tsx scripts/backfill-stores.mts [fromRound] [toRound] > worker/backfill-stores.sql
//   DELAY_MS=2000 npx tsx scripts/backfill-stores.mts ...   (slower; the source blocks IPs that request too fast)
//   npx wrangler d1 execute lotto-db --remote --file worker/backfill-stores.sql
// Responses are cached in worker/.cache/stores so an interrupted run resumes where it stopped.
// The Worker cron keeps recent rounds in sync after this.
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TICKET_COLUMNS, ticketValues } from '../worker/src/db';
import { fetchWinningTickets, FIRST_ROUND_WITH_STORES, unknownKeysSeen, type WinningTicket } from '../worker/src/dhlottery';
import { insertSql } from './sql.mts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY_MS = Number(process.env.DELAY_MS ?? 2000);
const cacheDir = resolve(import.meta.dirname, '../worker/.cache/stores');
mkdirSync(cacheDir, { recursive: true });

async function latestRound(): Promise<number> {
  const res = await fetch('https://lotto.q-ova.com/api/latest', { headers: { 'User-Agent': 'lotto-note-backfill' } });
  return ((await res.json()) as { round: number }).round;
}

// Retries transient network errors (timeouts, resets) with backoff.
async function fetchWithRetry(round: number, rank: 1 | 2): Promise<WinningTicket[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchWinningTickets(round, rank);
    } catch (err) {
      if (attempt >= 5) throw err;
      process.stderr.write(`\nround ${round} rank ${rank} failed (${(err as Error).message}), retry ${attempt}\n`);
      await sleep(2000 * attempt);
    }
  }
}

const from = Number(process.argv[2] ?? FIRST_ROUND_WITH_STORES);
const to = Number(process.argv[3] ?? (await latestRound()));
let fetched = 0;
let rows = 0;

for (let round = from; round <= to; round++) {
  for (const rank of [1, 2] as const) {
    const file = resolve(cacheDir, `${round}-${rank}.json`);
    let tickets: WinningTicket[];
    if (existsSync(file)) {
      tickets = JSON.parse(readFileSync(file, 'utf8'));
    } else {
      tickets = await fetchWithRetry(round, rank);
      writeFileSync(file, JSON.stringify(tickets));
      fetched++;
      await sleep(DELAY_MS); // be gentle: ~600 requests at 300 ms got this IP blocked for a while
    }
    console.log(`DELETE FROM winning_tickets WHERE round = ${round} AND rank = ${rank};`);
    for (const t of tickets) console.log(insertSql('INSERT', 'winning_tickets', TICKET_COLUMNS, ticketValues(t)));
    rows += tickets.length;
  }
  process.stderr.write(`\rround ${round}/${to}: ${rows} tickets (${fetched} fetched, rest cached)`);
}
process.stderr.write('\n');
if (unknownKeysSeen.size) {
  process.stderr.write(`unmapped API fields: ${[...unknownKeysSeen].join(', ')} — add them to worker/src/dhlottery.ts\n`);
  process.exit(1);
}
