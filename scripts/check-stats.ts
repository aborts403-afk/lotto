// Sanity checks for src/lib/lotto/stats.ts:  npx tsx scripts/check-stats.ts
import assert from 'node:assert/strict';
import rows from '../src/data/draws.json';
import { carryOverShare, consecutiveShare, lastDigitStats, numberDetail, sumDistribution, topPairs, expectedPairCount } from '../src/lib/lotto/stats';
import type { Draw } from '../src/lib/lotto/draws';

const draws: Draw[] = (rows as (number | string | null)[][])
  .map((r) => ({ round: r[0] as number, drawDate: r[1] as string, numbers: r.slice(2, 8) as number[], bonus: r[8] as number, ranks: [], totalSales: 0, firstPrizePickTypes: null }))
  .reverse();

const sums = sumDistribution(draws);
const theoryTotal = sums.reduce((a, r) => a + r.theoretical, 0);
assert.ok(theoryTotal > 0.99 && theoryTotal <= 1.0000001, `theory total ${theoryTotal}`);
assert.equal(sums.reduce((a, r) => a + r.count, 0), draws.length);
console.table(sums.map((r) => ({ bin: r.label, actual: (r.share * 100).toFixed(1), theory: (r.theoretical * 100).toFixed(1) })));
console.log('consecutive', consecutiveShare(draws));
console.log('carry-over', carryOverShare(draws));
const digits = lastDigitStats(draws);
assert.equal(Math.round(digits.reduce((a, r) => a + r.expected, 0)), draws.length * 6);
console.log('pairs', topPairs(draws, 3), 'expected', expectedPairCount(draws.length).toFixed(1));
const d7 = numberDetail(draws, 7);
console.log({ ...d7, rounds: d7.rounds.slice(0, 5) });
console.log('ok');
