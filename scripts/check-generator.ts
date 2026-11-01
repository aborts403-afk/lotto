// Sanity checks for src/lib/lotto/generator.ts:  npm run check:generator
import assert from 'node:assert/strict';
import { generateUnpopular, patternFlags, randomCombo, lessPopularThanPercent } from '../src/lib/lotto/generator';

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
console.log('ok');
