// Sanity checks for src/lib/lotto/generator.ts:  npm run check:generator
import assert from 'node:assert/strict';
import {
  anyPrizeChance,
  disjointPrizeChance,
  generate,
  independentPrizeChance,
  maxPairOverlap,
  pastWinningKeys,
  rareShape,
  simulatedPrizeChance,
  generateUnpopular,
  hashSeed,
  isBalanced,
  lessPopularThanPercent,
  patternFlags,
  randomCombo,
  seededRng,
} from '../src/lib/lotto/generator';

assert.deepEqual(patternFlags([1, 2, 3, 20, 33, 44]), ['run3']);
assert.ok(patternFlags([5, 10, 15, 20, 25, 44]).includes('arithmetic5'));
assert.ok(patternFlags([1, 8, 15, 22, 40, 44]).includes('slipLine')); // column 1 of the slip
assert.ok(patternFlags([1, 9, 17, 25, 40, 44]).includes('slipLine')); // diagonal
assert.ok(patternFlags([3, 9, 14, 20, 27, 31]).includes('allBirthday'));
assert.ok(patternFlags([3, 13, 23, 30, 38, 44]).includes('sameLastDigit3'));
assert.deepEqual(patternFlags([4, 15, 23, 36, 41, 45]), []);

let flagged = 0;
for (let i = 0; i < 10000; i++) if (patternFlags(randomCombo()).length) flagged++;
console.log(`random combos excluded by pattern rules: ${(flagged / 100).toFixed(1)}%`);

const sets = generateUnpopular(5);
assert.equal(sets.length, 5);
assert.equal(new Set(sets.map((s) => s.numbers.join(','))).size, 5);
for (const s of sets) {
  assert.equal(s.numbers.length, 6);
  assert.equal(new Set(s.numbers).size, 6);
  assert.ok(s.numbers.every((n) => n >= 1 && n <= 45));
  assert.deepEqual([...s.numbers], [...s.numbers].sort((a, b) => a - b));
  assert.deepEqual(patternFlags(s.numbers), []);
  console.log(s.numbers.join(' '), `→ less popular than ${s.lessPopularThan}% of random combos`);
}
const typical = Array.from({ length: 2000 }, () => lessPopularThanPercent(randomCombo()));
console.log(`random combo median percentile: ${typical.sort((a, b) => a - b)[1000]}% (should be ~50)`);

// Conditions
const sum = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);
for (const mode of ['unpopular', 'random'] as const) {
  const r = generate({ mode, count: 10, fixed: [7, 21], excluded: [1, 2, 3, 44, 45], oddCount: 3, sumRange: [100, 175] });
  assert.equal(r.error, undefined);
  assert.equal(r.sets.length, 10);
  assert.equal(new Set(r.sets.map((s) => s.numbers.join(','))).size, 10);
  for (const s of r.sets) {
    assert.ok(s.numbers.includes(7) && s.numbers.includes(21));
    assert.ok(![1, 2, 3, 44, 45].some((n) => s.numbers.includes(n)));
    assert.equal(s.numbers.filter((n) => n % 2 === 1).length, 3);
    assert.ok(sum(s.numbers) >= 100 && sum(s.numbers) <= 175);
  }
}
assert.equal(generate({ mode: 'random', count: 1, fixed: [1, 2, 3, 4, 5, 6] }).error, 'tooManyFixed');
assert.equal(generate({ mode: 'random', count: 1, excluded: Array.from({ length: 40 }, (_, i) => i + 1) }).error, 'notEnoughNumbers');
assert.equal(generate({ mode: 'random', count: 1, fixed: [1, 3, 5], oddCount: 2 }).error, 'oddEvenImpossible');
assert.equal(generate({ mode: 'random', count: 1, fixed: [1, 2, 3, 4, 5], sumRange: [200, 255] }).error, 'noMatch');
// Only 2 possible combos (5 fixed, 2 free numbers): returns what exists.
const few = generate({ mode: 'unpopular', count: 5, fixed: [1, 2, 3, 4, 5], excluded: Array.from({ length: 38 }, (_, i) => i + 8) });
assert.equal(few.sets.length, 2);
assert.equal(few.patternsRelaxed, true);

// Modes
const balanced = generate({ mode: 'balanced', count: 10 });
assert.equal(balanced.sets.length, 10);
assert.ok(balanced.sets.every((s) => isBalanced(s.numbers)));
assert.ok(!isBalanced([1, 2, 3, 4, 5, 6]));

const pool = [3, 8, 15, 22, 29, 34, 41];
const wheel = generate({ mode: 'wheel', count: 10, pool });
assert.equal(wheel.sets.length, 7); // C(7,6) = 7 combinations exist
assert.ok(wheel.sets.every((s) => s.numbers.every((n) => pool.includes(n))));
assert.equal(generate({ mode: 'wheel', count: 1, pool: [1, 2, 3, 4, 5] }).error, 'poolTooSmall');
const wheelFixed = generate({ mode: 'wheel', count: 5, pool, fixed: [3] });
assert.ok(wheelFixed.sets.every((s) => s.numbers.includes(3)));

// Weighted: number 45 gets almost all the weight, so it should appear in nearly every set.
const weights = Array.from({ length: 45 }, (_, i) => (i === 44 ? 1000 : 1));
const hot = generate({ mode: 'hot', count: 10, weights, spread: false });
assert.ok(hot.sets.filter((s) => s.numbers.includes(45)).length >= 9);
// With spreading (the default) a favorite cannot be in every set; it still leads the first one.
const hotSpread = generate({ mode: 'hot', count: 10, weights });
assert.ok(hotSpread.sets[0].numbers.includes(45));
assert.ok(maxPairOverlap(hotSpread.sets.map((s) => s.numbers)) <= 1);
const hotOdd = generate({ mode: 'hot', count: 10, weights, oddCount: 2 });
assert.ok(hotOdd.sets.every((s) => s.numbers.filter((n) => n % 2 === 1).length === 2));

// Phrase: same seed, same numbers.
const a = generate({ mode: 'phrase', count: 3 }, seededRng(hashSeed('홍길동|1249')));
const b = generate({ mode: 'phrase', count: 3 }, seededRng(hashSeed('홍길동|1249')));
const c = generate({ mode: 'phrase', count: 3 }, seededRng(hashSeed('홍길동|1250')));
assert.deepEqual(a.sets, b.sets);
assert.notDeepEqual(a.sets, c.sets);

// Spreading and past winning combinations
// Exact values from enumerating all 8,145,060 draws (2.383%, 7.135%, 11.868% for 1, 3, 5 disjoint sets).
const disjoint = (n: number) => Array.from({ length: n }, (_, i) => Array.from({ length: 6 }, (_, j) => i * 6 + j + 1));
assert.ok(Math.abs(disjointPrizeChance(disjoint(1))! - 0.023831) < 1e-5);
assert.ok(Math.abs(disjointPrizeChance(disjoint(3))! - 0.07135) < 1e-4);
assert.ok(Math.abs(disjointPrizeChance(disjoint(5))! - 0.11868) < 1e-4);
assert.ok(Math.abs(independentPrizeChance(5) - 0.11364) < 1e-4);
assert.equal(disjointPrizeChance([[1, 2, 3, 4, 5, 6], [6, 7, 8, 9, 10, 11]]), null);

const lastWin = [16, 18, 27, 36, 38, 42];
const past = pastWinningKeys([{ numbers: lastWin }]);
const onlyPast = generate({ mode: 'random', count: 1, fixed: [16, 18, 27, 36, 38], excluded: Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => ![16, 18, 27, 36, 38, 42, 43].includes(n)), pastWinning: past });
assert.deepEqual(onlyPast.sets.map((x) => x.numbers), [[16, 18, 27, 36, 38, 43]]);

for (const mode of ['random', 'unpopular', 'balanced', 'phrase'] as const) {
  for (const count of [3, 5, 10]) {
    const r = generate({ mode, count, pastWinning: past }, mode === 'phrase' ? seededRng(7) : Math.random);
    assert.equal(r.sets.length, count);
    const nums = r.sets.map((x) => x.numbers);
    assert.ok(maxPairOverlap(nums) <= (count * 6 > 45 ? 1 : 0), `${mode} ${count} overlap ${maxPairOverlap(nums)}`);
    assert.ok(anyPrizeChance(nums)!.chance > independentPrizeChance(count));
  }
}
const loose = generate({ mode: 'random', count: 5, spread: false });
assert.equal(loose.sets.length, 5);
// Rare shapes
assert.equal(rareShape([1, 3, 5, 7, 9, 11]), 'oddEven');
assert.equal(rareShape([23, 25, 30, 34, 40, 44]), 'highLow');
assert.equal(rareShape([1, 2, 5, 10, 24, 30]), 'sumLow');
assert.equal(rareShape([10, 11, 12, 13, 30, 41]), 'run4');
assert.equal(rareShape([3, 13, 23, 33, 40, 44]), 'lastDigit4');
assert.equal(rareShape([4, 15, 23, 36, 41, 45]), null);
assert.equal(rareShape([16, 18, 27, 36, 5, 9], [16, 18, 27, 36, 38, 42]), 'previous4');
for (const mode of ['random', 'unpopular', 'hot'] as const) {
  const r = generate({ mode, count: 10, weights: Array(45).fill(1), previous: [16, 18, 27, 36, 38, 42] });
  assert.ok(r.sets.every((x) => rareShape(x.numbers, [16, 18, 27, 36, 38, 42]) === null), mode);
}
const forced = generate({ mode: 'random', count: 3, fixed: [1, 2, 3, 4] });
assert.ok(forced.sets.length === 3 && forced.rareRelaxed);

// Simulation agrees with the exact count on a disjoint layout.
assert.ok(Math.abs(simulatedPrizeChance(disjoint(5)) - 0.11868) < 0.003);
console.log('spread: 5 sets', (anyPrizeChance(disjoint(5))!.chance * 100).toFixed(2), '% vs auto', (independentPrizeChance(5) * 100).toFixed(2), '%');
console.log('ok');
