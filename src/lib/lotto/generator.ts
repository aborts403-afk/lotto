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

// Small seeded PRNG (mulberry32) so the reference sample is identical on every run.
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Score distribution of uniformly random combinations, for turning a score into a percentile.
// Deterministic, so a percentile rendered into static HTML matches the one computed in the browser.
let referenceScores: number[] | null = null;
function getReferenceScores(): number[] {
  if (!referenceScores) {
    const rng = seededRng(645);
    referenceScores = Array.from({ length: 20000 }, () => popularityScore(randomCombo(rng))).sort((a, b) => a - b);
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

export type GenerateMode = 'unpopular' | 'random';

export type GenerateOptions = {
  mode: GenerateMode;
  count: number;
  fixed?: readonly number[]; // always included
  excluded?: readonly number[]; // never included
  oddCount?: number | null; // exact number of odd numbers, null = any
  sumRange?: readonly [number, number] | null; // inclusive, null = any
};

export type GenerateError =
  | 'tooManyFixed' // more than 5 fixed numbers
  | 'notEnoughNumbers' // exclusions leave fewer than 6 numbers
  | 'oddEvenImpossible' // fixed/excluded numbers make the odd/even split impossible
  | 'noMatch'; // nothing satisfied the conditions (usually the sum range)

export type GenerateResult = {
  sets: GeneratedCombo[];
  error?: GenerateError;
  // Unpopular mode only: fixed or excluded numbers forced some "people pick this on purpose" shapes back in.
  patternsRelaxed?: boolean;
};

export const MAX_FIXED = 5;

const CANDIDATES = 4000;
const MAX_ATTEMPTS = 40000;
const POOL_FRACTION = 0.1; // unpopular mode: pick from the least-popular 10% of pattern-free candidates

function sample<T>(from: readonly T[], k: number, rng: () => number): T[] {
  const a = [...from];
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

export function generate(options: GenerateOptions, rng: () => number = Math.random): GenerateResult {
  const { mode, count } = options;
  const fixed = [...new Set(options.fixed ?? [])];
  const excluded = new Set(options.excluded ?? []);
  const oddCount = options.oddCount ?? null;
  const sumRange = options.sumRange ?? null;

  if (fixed.length > MAX_FIXED) return { sets: [], error: 'tooManyFixed' };
  const free = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !excluded.has(n) && !fixed.includes(n));
  const need = 6 - fixed.length;
  if (free.length < need) return { sets: [], error: 'notEnoughNumbers' };

  // With an odd/even condition, draw the odd and even parts separately so every candidate satisfies it.
  const freeOdd = free.filter((n) => n % 2 === 1);
  const freeEven = free.filter((n) => n % 2 === 0);
  let needOdd = 0;
  if (oddCount !== null) {
    needOdd = oddCount - fixed.filter((n) => n % 2 === 1).length;
    const needEven = need - needOdd;
    if (needOdd < 0 || needEven < 0 || needOdd > freeOdd.length || needEven > freeEven.length) {
      return { sets: [], error: 'oddEvenImpossible' };
    }
  }

  const draw = (): Combo => {
    const picked = oddCount === null ? sample(free, need, rng) : [...sample(freeOdd, needOdd, rng), ...sample(freeEven, need - needOdd, rng)];
    return [...fixed, ...picked].sort((a, b) => a - b);
  };
  const inSum = (c: Combo) => {
    if (!sumRange) return true;
    const sum = c.reduce((a, b) => a + b, 0);
    return sum >= sumRange[0] && sum <= sumRange[1];
  };

  // Collect distinct candidates that satisfy every condition.
  const target = mode === 'random' ? count : CANDIDATES;
  const candidates = new Map<string, Combo>();
  for (let i = 0; i < MAX_ATTEMPTS && candidates.size < target; i++) {
    const c = draw();
    if (inSum(c)) candidates.set(c.join(','), c);
  }
  if (candidates.size === 0) return { sets: [], error: 'noMatch' };

  const toResult = (c: Combo): GeneratedCombo => ({ numbers: c, lessPopularThan: lessPopularThanPercent(c) });

  if (mode === 'random') return { sets: [...candidates.values()].slice(0, count).map(toResult) };

  let pool = [...candidates.values()];
  let patternsRelaxed = false;
  const patternFree = pool.filter((c) => patternFlags(c).length === 0);
  if (patternFree.length >= count) pool = patternFree;
  else patternsRelaxed = true;

  const scored = pool.map((combo) => ({ combo, score: popularityScore(combo) })).sort((a, b) => a.score - b.score);
  const best = scored.slice(0, Math.max(count, Math.floor(scored.length * POOL_FRACTION)));
  const picks = sample(best.map((s) => s.combo), Math.min(count, best.length), rng);
  return { sets: picks.map(toResult), patternsRelaxed };
}

export function generateUnpopular(count = 5, rng: () => number = Math.random): GeneratedCombo[] {
  return generate({ mode: 'unpopular', count }, rng).sets;
}
