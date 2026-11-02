// Sanity checks for payout estimates and the simulator:  npm run check:payout
import assert from 'node:assert/strict';
import rows from '../src/data/draws.json';
import type { Draw } from '../src/lib/lotto/draws';
import { generate } from '../src/lib/lotto/generator';
import { afterTax, diagnose, estimatePayout, popularityMultiplier } from '../src/lib/lotto/payout';
import { simulate } from '../src/lib/lotto/simulate';

const draws: Draw[] = (rows as (number | string | null)[][])
  .map((r) => {
    const n = (i: number) => r[i] as number;
    return {
      round: n(0),
      drawDate: r[1] as string,
      numbers: [n(2), n(3), n(4), n(5), n(6), n(7)],
      bonus: n(8),
      ranks: [0, 1, 2, 3, 4].map((k) => ({ winners: n(9 + k * 2), prize: n(10 + k * 2) })),
      totalSales: n(19),
      firstPrizePickTypes: null,
    };
  })
  .reverse();

assert.equal(afterTax(1_000_000), 1_000_000);
assert.equal(afterTax(100_000_000), 78_000_000);
assert.equal(afterTax(1_000_000_000), 300_000_000 * 0.78 + 700_000_000 * 0.67);

const birthday = [3, 7, 12, 17, 21, 28];
const unpopular = generate({ mode: 'unpopular', count: 1 }).sets[0].numbers;
const pb = estimatePayout(birthday, draws);
const pu = estimatePayout(unpopular, draws);
const fmt = (w: number) => `${(w / 1e8).toFixed(1)}억`;
console.log('basis', pb.basis);
console.log(
  'birthday ',
  birthday.join(' '),
  'mult',
  popularityMultiplier(birthday).toFixed(3),
  'others',
  pb.others.toFixed(1),
  'net',
  fmt(pb.net),
  'avg',
  fmt(pb.averageNet),
);
console.log(
  'unpopular',
  unpopular.join(' '),
  'mult',
  popularityMultiplier(unpopular).toFixed(3),
  'others',
  pu.others.toFixed(1),
  'net',
  fmt(pu.net),
);
assert.ok(pu.net > pb.net, 'less popular combination should expect more');
assert.ok(pb.net < pb.averageNet && pu.net > pu.averageNet);
assert.ok(pb.gross > pb.net);
console.log('diagnosis', diagnose(birthday));
assert.equal(diagnose(birthday).verdict, 'popular');

// Simulator: the 1248th draw's own numbers win the 1st prize in that draw.
const latest = draws[0];
const s = simulate(latest.numbers, draws, 1);
assert.equal(s.counts[1], 1);
assert.deepEqual(s.firstWins, [latest.round]);
const all = simulate(birthday, draws, null);
assert.equal(all.draws, draws.length);
assert.equal(all.spent, 87 * 2000 + (draws.length - 87) * 1000);
console.log(
  'birthday since round 1:',
  all.counts,
  'spent',
  all.spent,
  'won',
  all.won,
  'rate',
  (all.returnRate * 100).toFixed(1) + '%',
  'best',
  all.best,
);
console.log('ok');

// Ticket QR (examples are real dhlottery URLs).
import('../src/lib/lotto/check').then(({ parseTicketQr }) => {
  const one = parseTicketQr('https://m.dhlottery.co.kr/qr.do?method=winQr&v=1107m061430314041');
  assert.deepEqual(one, { round: 1107, games: [[6, 14, 30, 31, 40, 41]] });
  const five = parseTicketQr(
    'https://m.dhlottery.co.kr/qr.do?method=winQr&v=1125m152023263944m070827293643m161722303743m010821273639m2533344044450000000645',
  );
  assert.equal(five?.round, 1125);
  assert.equal(five?.games.length, 5);
  assert.deepEqual(five?.games[4], [25, 33, 34, 40, 44, 45]);
  // older tickets: zero-padded round, q marker
  assert.deepEqual(parseTicketQr('http://qr.dhlottery.co.kr/?v=0868q022935364043'), { round: 868, games: [[2, 29, 35, 36, 40, 43]] });
  assert.equal(parseTicketQr('https://example.com'), null);
  assert.equal(parseTicketQr('https://m.dhlottery.co.kr/qr.do?v=1125m151515151515'), null); // repeated numbers
  console.log('qr ok');
});
