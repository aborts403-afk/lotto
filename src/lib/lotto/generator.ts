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
export function seededRng(seed: number): () => number {
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

export type GenerateMode =
  | 'unpopular' // least popular combinations (fewer people to share the 1st prize with)
  | 'random' // uniform, like an auto-pick ticket
  | 'hot' // numbers weighted toward those drawn often recently
  | 'cold' // numbers weighted toward those not drawn for a long time
  | 'pattern' // numbers weighted by the rule that fitted past draws best (see pattern.ts; it predicts nothing)
  | 'balanced' // shapes most past winning numbers have (odd/even, high/low, sum, no long runs)
  | 'wheel' // every set is made only from the user's candidate numbers
  | 'phrase'; // seeded by a phrase (name, birthday, dream...): same phrase, same numbers this week

// String -> 32-bit seed (FNV-1a), for the phrase mode.
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const BALANCED_SUM = [100, 175] as const;

// "Looks like a typical winning combination": 2-4 odd, 2-4 high (23-45), sum 100-175, at most one
// consecutive pair, and numbers from at least three of the five ranges (1-10, 11-20, ...).
// Every combination is equally likely to win; this only matches the most common shape.
export function isBalanced(combo: Combo): boolean {
  const odd = combo.filter((n) => n % 2 === 1).length;
  const high = combo.filter((n) => n >= 23).length;
  const sum = combo.reduce((a, b) => a + b, 0);
  const s = [...combo].sort((a, b) => a - b);
  let pairs = 0;
  for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1] + 1) pairs++;
  const ranges = new Set(s.map((n) => Math.min(4, Math.floor((n - 1) / 10)))).size;
  return odd >= 2 && odd <= 4 && high >= 2 && high <= 4 && sum >= BALANCED_SUM[0] && sum <= BALANCED_SUM[1] && pairs <= 1 && ranges >= 3;
}

export type GenerateOptions = {
  mode: GenerateMode;
  count: number;
  fixed?: readonly number[]; // always included
  excluded?: readonly number[]; // never included
  oddCount?: number | null; // exact number of odd numbers, null = any
  sumRange?: readonly [number, number] | null; // inclusive, null = any
  weights?: readonly number[] | null; // hot/cold/pattern: relative weight of each number 1..45 (index n-1)
  pool?: readonly number[] | null; // wheel: candidate numbers; sets use only these (plus fixed)
  // Past 1st-prize combinations (comboKey) never returned. They are as likely as any other combination;
  // they are left out only because a generator handing back an old winning ticket looks broken.
  pastWinning?: ReadonlySet<string> | null;
  // Keep sets from sharing numbers (default true, ignored in wheel mode). The expected number of winning
  // tickets is the same either way, but spread-out sets win in more different weeks, so the chance
  // that at least one set wins something this week is higher (see anyPrizeChance).
  spread?: boolean;
  // Leave out rare shapes (default true, ignored in wheel mode); `previous` is the latest draw's numbers.
  skipRare?: boolean;
  previous?: readonly number[] | null;
};

// Shapes that few combinations have, so they are rarely drawn (about 11% of all combinations together;
// 12.5% of the first 1,248 draws had one). Each such combination is exactly as likely as any other:
// leaving them out does not raise the chance of a ticket, it only avoids handing out odd-looking sets.
export type RareShape =
  | 'oddEven' // all odd or all even
  | 'highLow' // all 1–22 or all 23–45
  | 'sumLow' // sum below 80
  | 'sumHigh' // sum above 200
  | 'run4' // 4+ consecutive numbers
  | 'pairs3' // 3+ consecutive pairs
  | 'decade5' // 5+ numbers in one of 1–10, 11–20, 21–30, 31–40, 41–45
  | 'lastDigit4' // 4+ numbers ending in the same digit
  | 'slipLine4' // 4+ numbers in one row or column of the slip
  | 'previous4'; // 4+ numbers of the previous draw

export const RARE_SHAPE_SHARE = 0.109; // all combinations having at least one rare shape (exact count: 10.8% + previous4)

export function rareShape(combo: Combo, previous?: readonly number[] | null): RareShape | null {
  const s = [...combo].sort((a, b) => a - b);
  const odd = s.filter((n) => n % 2 === 1).length;
  if (odd === 0 || odd === 6) return 'oddEven';
  const high = s.filter((n) => n >= 23).length;
  if (high === 0 || high === 6) return 'highLow';
  const sum = s.reduce((a, b) => a + b, 0);
  if (sum < 80) return 'sumLow';
  if (sum > 200) return 'sumHigh';
  let run = 1;
  let pairs = 0;
  for (let i = 1; i < 6; i++) {
    if (s[i] === s[i - 1] + 1) {
      pairs++;
      if (++run >= 4) return 'run4';
    } else run = 1;
  }
  if (pairs >= 3) return 'pairs3';
  const decade = new Array<number>(5).fill(0);
  const digit = new Array<number>(10).fill(0);
  const row = new Array<number>(7).fill(0);
  const col = new Array<number>(7).fill(0);
  for (const n of s) {
    if (++decade[Math.min(4, Math.floor((n - 1) / 10))] >= 5) return 'decade5';
    if (++digit[n % 10] >= 4) return 'lastDigit4';
    if (++row[Math.floor((n - 1) / SLIP_COLUMNS)] >= 4 || ++col[(n - 1) % SLIP_COLUMNS] >= 4) return 'slipLine4';
  }
  if (previous && s.filter((n) => previous.includes(n)).length >= 4) return 'previous4';
  return null;
}

export const comboKey = (c: readonly number[]) => [...c].sort((a, b) => a - b).join(',');

// Keys of every past winning combination, cached per draws array.
const pastCache = new WeakMap<readonly { numbers: readonly number[] }[], ReadonlySet<string>>();
export function pastWinningKeys(draws: readonly { numbers: readonly number[] }[]): ReadonlySet<string> {
  let keys = pastCache.get(draws);
  if (!keys) {
    keys = new Set(draws.map((d) => comboKey(d.numbers)));
    pastCache.set(draws, keys);
  }
  return keys;
}

function overlap(a: Combo, b: Combo): number {
  let k = 0;
  for (const n of a) if (b.includes(n)) k++;
  return k;
}

export function maxPairOverlap(sets: readonly Combo[]): number {
  let m = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) m = Math.max(m, overlap(sets[i], sets[j]));
  return m;
}

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
const ALL = binom(45, 6);

// Chance that one ticket wins 5th prize or better (3+ numbers): 2.38%.
export const SINGLE_PRIZE_CHANCE = 1 - (binom(39, 6) + 6 * binom(39, 5) + 15 * binom(39, 4)) / ALL;

// Chance that at least one of n independently picked tickets (an ordinary auto pick) wins something.
export function independentPrizeChance(n: number): number {
  return 1 - (1 - SINGLE_PRIZE_CHANCE) ** n;
}

// Exact chance that at least one of `sets` wins 5th prize or better, when no two sets share a number:
// the draw must hit at most 2 numbers of every set. Counted with a polynomial over the disjoint sets
// and the remaining numbers. Returns null when sets share numbers (then it depends on the layout).
export function disjointPrizeChance(sets: readonly Combo[]): number | null {
  if (sets.length === 0 || maxPairOverlap(sets) > 0) return null;
  const rest = 45 - 6 * sets.length;
  let poly = Array.from({ length: 7 }, (_, j) => binom(rest, j)); // ways to pick j numbers outside every set
  for (let s = 0; s < sets.length; s++) {
    const next = new Array<number>(7).fill(0);
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 2 && i + j <= 6; j++) next[i + j] += poly[i] * binom(6, j);
    poly = next;
  }
  return 1 - poly[6] / ALL;
}

// Same chance for sets that share numbers, by simulating a fixed sequence of draws (seeded, so the
// same sets always give the same answer). 200,000 draws: about ±0.1 percentage points.
// Numbers are bitmasks split in two 32-bit halves (1–30, 31–45) so each check is two popcounts.
export function simulatedPrizeChance(sets: readonly Combo[], draws = 200_000): number {
  const rng = seededRng(4506);
  const bit = (n: number) => (n <= 30 ? [1 << (n - 1), 0] : [0, 1 << (n - 31)]);
  const lo = new Int32Array(sets.length);
  const hi = new Int32Array(sets.length);
  sets.forEach((s, i) => {
    for (const n of s) {
      const [a, b] = bit(n);
      lo[i] |= a;
      hi[i] |= b;
    }
  });
  const popcount = (x: number) => {
    x -= (x >>> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  };
  const deck = new Int8Array(45).map((_, i) => i + 1);
  let any = 0;
  for (let t = 0; t < draws; t++) {
    let dl = 0;
    let dh = 0;
    for (let i = 0; i < 6; i++) {
      const j = i + Math.floor(rng() * (45 - i));
      const n = deck[j];
      deck[j] = deck[i];
      deck[i] = n;
      if (n <= 30) dl |= 1 << (n - 1);
      else dh |= 1 << (n - 31);
    }
    for (let i = 0; i < lo.length; i++) {
      if (popcount(dl & lo[i]) + popcount(dh & hi[i]) >= 3) {
        any++;
        break;
      }
    }
  }
  return any / draws;
}

// Chance that at least one set wins 5th prize or better this week: exact when the sets share no
// number, simulated otherwise (e.g. 10 sets, which cannot all be disjoint).
export function anyPrizeChance(sets: readonly Combo[]): { chance: number; exact: boolean } | null {
  if (sets.length === 0) return null;
  const exact = disjointPrizeChance(sets);
  return exact !== null ? { chance: exact, exact: true } : { chance: simulatedPrizeChance(sets), exact: false };
}

export type GenerateError =
  | 'tooManyFixed' // more than 5 fixed numbers
  | 'notEnoughNumbers' // exclusions leave fewer than 6 numbers
  | 'oddEvenImpossible' // fixed/excluded numbers make the odd/even split impossible
  | 'noMatch' // nothing satisfied the conditions (usually the sum range)
  | 'poolTooSmall'; // wheel: fewer than 6 candidate numbers

export type GenerateResult = {
  sets: GeneratedCombo[];
  error?: GenerateError;
  // Unpopular mode only: fixed or excluded numbers forced some "people pick this on purpose" shapes back in.
  patternsRelaxed?: boolean;
  // Spreading was on but the conditions (fixed numbers, few numbers left, ...) forced sets to share more.
  spreadRelaxed?: boolean;
  // Rare shapes were left out but the conditions (fixed numbers, ...) left no other choice for some sets.
  rareRelaxed?: boolean;
};

export const MAX_FIXED = 5;

const CANDIDATES = 4000;
const MAX_ATTEMPTS = 40000;
const POOL_FRACTION = 0.1; // unpopular mode: pick from the least-popular 10% of pattern-free candidates
const ATTEMPTS_PER_SET = 1500;

// k distinct numbers, each pick proportional to its weight among those not yet picked.
function weightedSample(from: readonly number[], k: number, weights: readonly number[], rng: () => number): number[] {
  const left = [...from];
  const out: number[] = [];
  for (let i = 0; i < k && left.length; i++) {
    const total = left.reduce((sum, n) => sum + weights[n - 1], 0);
    let r = rng() * total;
    let j = 0;
    while (j < left.length - 1 && (r -= weights[left[j] - 1]) >= 0) j++;
    out.push(left[j]);
    left.splice(j, 1);
  }
  return out;
}

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
  const weighted =
    (mode === 'hot' || mode === 'cold' || mode === 'pattern') && options.weights?.length === 45 ? options.weights : null;
  const pool = mode === 'wheel' ? new Set(options.pool ?? []) : null;

  if (fixed.length > MAX_FIXED) return { sets: [], error: 'tooManyFixed' };
  if (pool && pool.size + fixed.filter((n) => !pool.has(n)).length < 6) return { sets: [], error: 'poolTooSmall' };
  const free = Array.from({ length: 45 }, (_, i) => i + 1).filter(
    (n) => !excluded.has(n) && !fixed.includes(n) && (!pool || pool.has(n)),
  );
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

  // One candidate; with `avoid`, only from numbers not in it (null when too few are left).
  // `uniform` ignores the hot/cold/pattern weights.
  const draw = (avoid?: ReadonlySet<number>, uniform = false): Combo | null => {
    const pick = (from: readonly number[], k: number) =>
      weighted && !uniform ? weightedSample(from, k, weighted, rng) : sample(from, k, rng);
    const left = (from: readonly number[]) => (avoid ? from.filter((n) => !avoid.has(n)) : from);
    const [all, odds, evens] = [left(free), left(freeOdd), left(freeEven)];
    if (oddCount === null) return all.length < need ? null : [...fixed, ...pick(all, need)].sort((a, b) => a - b);
    if (odds.length < needOdd || evens.length < need - needOdd) return null;
    return [...fixed, ...pick(odds, needOdd), ...pick(evens, need - needOdd)].sort((a, b) => a - b);
  };
  const pastWinning = options.pastWinning ?? null;
  const skipRare = options.skipRare !== false && mode !== 'wheel';
  const previous = options.previous ?? null;
  // `strict` = also leave out rare shapes; dropped only as a last resort.
  const accept = (c: Combo, strict = true) => {
    if (pastWinning?.has(c.join(','))) return false;
    if (strict && skipRare && rareShape(c, previous)) return false;
    if (mode === 'balanced' && !isBalanced(c)) return false;
    if (!sumRange) return true;
    const sum = c.reduce((a, b) => a + b, 0);
    return sum >= sumRange[0] && sum <= sumRange[1];
  };

  // How many numbers two sets may share. Fixed numbers are in every set; beyond them, sets share
  // nothing while the free numbers last, and at most one more once they run out (e.g. 10 sets).
  const spread = options.spread !== false && mode !== 'wheel' && count > 1;
  const baseLimit = spread ? fixed.length + (count * need > free.length ? 1 : 0) : 6;

  const toResult = (c: Combo): GeneratedCombo => ({ numbers: c, lessPopularThan: lessPopularThanPercent(c) });

  // Every mode but the unpopular one: build the sets one by one. A new set is drawn first from numbers
  // no earlier set uses (keeps the hot/cold/pattern weighting among what is left), then from all
  // numbers within the overlap limit, then without the weighting (which can keep returning the same
  // favorites), then allowing rare shapes, and the limit is loosened only when all of that fails.
  if (mode !== 'unpopular') {
    const chosen: Combo[] = [];
    const keys = new Set<string>();
    let limit = baseLimit;
    let attempts = 0;
    let rareRelaxed = false;
    const phases = skipRare ? 4 : 3;
    while (chosen.length < count && attempts < MAX_ATTEMPTS * 2 && limit <= 6) {
      const used = new Set(chosen.flat().filter((n) => !fixed.includes(n)));
      let found: Combo | null = null;
      for (let i = 0; i < ATTEMPTS_PER_SET * phases && !found; i++, attempts++) {
        const strict = i < ATTEMPTS_PER_SET * 3;
        const c = draw(spread && i < ATTEMPTS_PER_SET ? used : undefined, i >= ATTEMPTS_PER_SET * 2);
        if (c && accept(c, strict) && !keys.has(c.join(',')) && chosen.every((x) => overlap(x, c) <= limit)) {
          found = c;
          if (!strict) rareRelaxed = true;
        }
      }
      if (found) {
        chosen.push(found);
        keys.add(found.join(','));
      } else limit++;
    }
    if (chosen.length === 0) return { sets: [], error: 'noMatch' };
    return { sets: chosen.map(toResult), spreadRelaxed: spread && limit > baseLimit, rareRelaxed };
  }

  // Unpopular mode: rank a large pool of candidates that satisfy every condition (rare shapes allowed
  // only when too few candidates are left without them).
  const candidates = new Map<string, Combo>();
  let rareRelaxed = false;
  for (const strict of skipRare ? [true, false] : [true]) {
    if (candidates.size >= count) break;
    if (!strict) rareRelaxed = true;
    for (let i = 0; i < MAX_ATTEMPTS && candidates.size < CANDIDATES; i++) {
      const c = draw();
      if (c && accept(c, strict)) candidates.set(c.join(','), c);
    }
  }
  if (candidates.size === 0) return { sets: [], error: 'noMatch' };

  // Greedy in the given order; when the overlap limit cannot be met, allow one more shared number.
  const choose = (ordered: readonly Combo[]) => {
    const chosen: Combo[] = [];
    let limit = baseLimit;
    while (chosen.length < count && limit <= 6) {
      for (const c of ordered) {
        if (chosen.length >= count) break;
        if (!chosen.includes(c) && chosen.every((x) => overlap(x, c) <= limit)) chosen.push(c);
      }
      if (chosen.length < count) limit++;
    }
    return { chosen, spreadRelaxed: spread && limit > baseLimit };
  };

  let ranked = [...candidates.values()];
  let patternsRelaxed = false;
  const patternFree = ranked.filter((c) => patternFlags(c).length === 0);
  if (patternFree.length >= count) ranked = patternFree;
  else patternsRelaxed = true;

  // Random order within the least-popular pool, then the rest from least to most popular, so spreading
  // only reaches past the pool when it has to.
  const scored = ranked.map((combo) => ({ combo, score: popularityScore(combo) })).sort((a, b) => a.score - b.score);
  const poolSize = Math.max(count, Math.floor(scored.length * POOL_FRACTION));
  const best = scored.slice(0, poolSize).map((x) => x.combo);
  const order = [...sample(best, best.length, rng), ...scored.slice(poolSize).map((x) => x.combo)];
  const { chosen, spreadRelaxed } = choose(order);
  return { sets: chosen.map(toResult), patternsRelaxed, spreadRelaxed, rareRelaxed };
}

export function generateUnpopular(count = 5, rng: () => number = Math.random): GeneratedCombo[] {
  return generate({ mode: 'unpopular', count }, rng).sets;
}
