// "Unpopular numbers" generator.
//
// Every combination has exactly the same chance of winning (1 / 8,145,060). What differs is how many
// OTHER players picked the same combination, i.e. how many people you would split the 1st prize with.
// We estimate that from past draws (see analysis/popularity.py) and prefer combinations that fewer
// people are likely to have chosen.
//
// Picks are random among the least-popular pool rather than "the single best" combination: if everyone
// using this app got the same numbers, those numbers would become popular.

import { NUMBER_WEIGHTS } from './popularity-weights';

export type Combo = readonly number[]; // 6 sorted numbers, 1..45

const SLIP_COLUMNS = 7; // the paper slip lays out 1..45 in rows of 7

export type PatternFlag =
  | 'run3' // 3+ consecutive numbers, e.g. 12-13-14
  | 'arithmetic5' // 5+ numbers with equal spacing, e.g. 5-10-15-20-25
  | 'slipLine' // 4+ numbers in one row, column, or diagonal of the slip
  | 'allBirthday' // all six numbers 1..31 (dates)
  | 'sameLastDigit3'; // 3+ numbers ending in the same digit

// Shapes people commonly pick on purpose. Past draws rarely contain them, so they cannot be learned
// from the data; we exclude them by rule as a precaution.
export function patternFlags(combo: Combo): PatternFlag[] {
  const flags: PatternFlag[] = [];
  const s = [...combo].sort((a, b) => a - b);

  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] + 1 ? run + 1 : 1;
    if (run >= 3) {
      flags.push('run3');
      break;
    }
  }

  const set = new Set(s);
  outer: for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const d = s[j] - s[i];
      let len = 2;
      while (set.has(s[i] + d * len)) len++;
      if (len >= 5) {
        flags.push('arithmetic5');
        break outer;
      }
    }
  }

  const row = (n: number) => Math.floor((n - 1) / SLIP_COLUMNS);
  const col = (n: number) => (n - 1) % SLIP_COLUMNS;
  const lines = new Map<string, number>();
  for (const n of s) {
    for (const key of [`r${row(n)}`, `c${col(n)}`, `d${row(n) - col(n)}`, `a${row(n) + col(n)}`]) {
      lines.set(key, (lines.get(key) ?? 0) + 1);
    }
  }
  if ([...lines.values()].some((v) => v >= 4)) flags.push('slipLine');

  if (s.every((n) => n <= 31)) flags.push('allBirthday');

  const digits = new Map<number, number>();
  for (const n of s) digits.set(n % 10, (digits.get(n % 10) ?? 0) + 1);
  if ([...digits.values()].some((v) => v >= 3)) flags.push('sameLastDigit3');

  return flags;
}

// Estimated log-popularity of a combination. 0 = average; negative = fewer players expected to pick it.
export function popularityScore(combo: Combo): number {
  return combo.reduce((sum, n) => sum + NUMBER_WEIGHTS[n - 1], 0);
}

export function randomCombo(rng: () => number = Math.random): Combo {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = 0; i < 6; i++) {
    const j = i + Math.floor(rng() * (45 - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 6).sort((a, b) => a - b);
}

// Score distribution of uniformly random combinations, for turning a score into a percentile.
let referenceScores: number[] | null = null;
function getReferenceScores(): number[] {
  if (!referenceScores) {
    referenceScores = Array.from({ length: 20000 }, () => popularityScore(randomCombo())).sort((a, b) => a - b);
  }
  return referenceScores;
}

// Share of random combinations (0..100) that are estimated to be MORE popular than this one.
export function lessPopularThanPercent(combo: Combo): number {
  const ref = getReferenceScores();
  const score = popularityScore(combo);
  let lo = 0;
  let hi = ref.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ref[mid] <= score) lo = mid + 1;
    else hi = mid;
  }
  return Math.round(((ref.length - lo) / ref.length) * 100);
}

export type GeneratedCombo = { numbers: Combo; lessPopularThan: number };

const CANDIDATES = 4000;
const POOL_FRACTION = 0.1; // pick from the least-popular 10% of pattern-free candidates

export function generateUnpopular(count = 5, rng: () => number = Math.random): GeneratedCombo[] {
  const candidates: { combo: Combo; score: number }[] = [];
  for (let i = 0; i < CANDIDATES; i++) {
    const combo = randomCombo(rng);
    if (patternFlags(combo).length === 0) candidates.push({ combo, score: popularityScore(combo) });
  }
  candidates.sort((a, b) => a.score - b.score);
  const pool = candidates.slice(0, Math.max(count, Math.floor(candidates.length * POOL_FRACTION)));

  const picked: GeneratedCombo[] = [];
  const seen = new Set<string>();
  while (picked.length < count && seen.size < pool.length) {
    const { combo } = pool[Math.floor(rng() * pool.length)];
    const key = combo.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ numbers: combo, lessPopularThan: lessPopularThanPercent(combo) });
  }
  return picked;
}
