// Sanity checks for src/lib/lotto/stats.ts:  npx tsx scripts/check-stats.ts
import assert from 'node:assert/strict';
import rows from '../src/data/draws.json';
import { carryOverShare, consecutiveShare, lastDigitStats, numberDetail, sumDistribution, topPairs, expectedPairCount } from '../src/lib/lotto/stats';
import type { Draw } from '../src/lib/lotto/draws';
import { patternBacktest, patternTop6, patternWeights } from '../src/lib/lotto/pattern';

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

// ---- 역대 패턴으로 뽑기 (pattern.ts) ----
{
  const top = patternTop6(draws);
  assert.equal(new Set(top).size, 6);
  assert.ok(top.every((n) => n >= 1 && n <= 45));
  const w = patternWeights(draws);
  assert.equal(w.length, 45);
  assert.ok(top.every((n) => w[n - 1] >= Math.max(...w) * Math.exp(-5 / 6) - 1e-9), 'top six carry the largest weights');
  const test = patternBacktest(draws);
  assert.ok(test && test.rounds === 348 && test.hits > 0.55 && test.hits < 1.05, `backtest ${JSON.stringify(test)}`);
  console.log('pattern top6', top.join(' '), 'backtest', test);
}
