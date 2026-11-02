// Descriptive statistics over past draws. None of these predict the next draw: every draw is an
// independent uniform pick, so differences between numbers are what randomness alone produces.
import { TOTAL_COMBINATIONS, type Draw } from './draws';

export type NumberStat = { n: number; count: number; lastRound: number | null; drawsSince: number | null };

// draws: newest first.
export function numberStats(draws: readonly Draw[], includeBonus = false): NumberStat[] {
  const stats: NumberStat[] = Array.from({ length: 45 }, (_, i) => ({ n: i + 1, count: 0, lastRound: null, drawsSince: null }));
  const latest = draws[0]?.round ?? 0;
  for (const d of draws) {
    const nums = includeBonus ? [...d.numbers, d.bonus] : d.numbers;
    for (const n of nums) {
      const s = stats[n - 1];
      s.count++;
      if (s.lastRound === null) {
        s.lastRound = d.round;
        s.drawsSince = latest - d.round;
      }
    }
  }
  return stats;
}

// Expected appearances of each number among the six main numbers: draws * 6/45.
export function expectedCount(drawCount: number): number {
  return (drawCount * 6) / 45;
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export type SplitRow = { k: number; count: number; share: number; theoretical: number };

// Distribution of "how many of the six numbers satisfy pred" (e.g. odd, or 23-45), with the
// exact theoretical probability for a uniform draw (hypergeometric).
export function splitDistribution(draws: readonly Draw[], pred: (n: number) => boolean): SplitRow[] {
  const yes = Array.from({ length: 45 }, (_, i) => i + 1).filter(pred).length;
  const no = 45 - yes;
  const counts = new Array(7).fill(0);
  for (const d of draws) counts[d.numbers.filter(pred).length]++;
  return counts.map((count, k) => ({
    k,
    count,
    share: draws.length ? count / draws.length : 0,
    theoretical: (comb(yes, k) * comb(no, 6 - k)) / TOTAL_COMBINATIONS,
  }));
}

export const isOdd = (n: number) => n % 2 === 1;
export const isHigh = (n: number) => n >= 23;

export type PickTypeTotals = { auto: number; manual: number; semiAuto: number; rounds: number; fromRound: number };

// 1st-prize winners by pick type over the draws that have a breakdown.
export function pickTypeTotals(draws: readonly Draw[]): PickTypeTotals | null {
  const withData = draws.filter((d) => d.firstPrizePickTypes);
  if (withData.length === 0) return null;
  const t = { auto: 0, manual: 0, semiAuto: 0, rounds: withData.length, fromRound: Math.min(...withData.map((d) => d.round)) };
  for (const d of withData) {
    t.auto += d.firstPrizePickTypes!.auto;
    t.manual += d.firstPrizePickTypes!.manual;
    t.semiAuto += d.firstPrizePickTypes!.semiAuto;
  }
  return t;
}

export function topBy<T>(items: readonly T[], key: (t: T) => number, count: number, ascending = false): T[] {
  return [...items].sort((a, b) => (ascending ? key(a) - key(b) : key(b) - key(a))).slice(0, count);
}

// ---- Generator weights (번호 생성: 많이 나온 / 오래 안 나온 번호 위주) ----

export const HOT_WINDOW = 100;

// Weight ∝ (appearances in the last HOT_WINDOW draws)², so frequent numbers are clearly favored.
export function hotWeights(drawsDesc: readonly Draw[]): number[] {
  return numberStats(drawsDesc.slice(0, HOT_WINDOW)).map((s) => Math.max(1, s.count) ** 2);
}

// Weight ∝ draws since the number last appeared (+1), so long-absent numbers are favored.
export function coldWeights(drawsDesc: readonly Draw[]): number[] {
  return numberStats(drawsDesc).map((s) => (s.drawsSince ?? drawsDesc.length) + 1);
}

// ---- Sum of the six numbers ----

// Exact number of combinations for every sum 21..255 (subset-sum DP over 1..45 choosing 6).
let sumCounts: number[] | null = null;
function combinationsBySum(): number[] {
  if (sumCounts) return sumCounts;
  // dp[k][s] = ways to choose k numbers with sum s
  const dp = Array.from({ length: 7 }, () => new Array(256).fill(0));
  dp[0][0] = 1;
  for (let n = 1; n <= 45; n++) {
    for (let k = 6; k >= 1; k--) {
      for (let s = 255; s >= n; s--) dp[k][s] += dp[k - 1][s - n];
    }
  }
  sumCounts = dp[6];
  return sumCounts;
}

export type BinRow = { label: string; from: number; to: number; count: number; share: number; theoretical: number };

export function sumDistribution(draws: readonly Draw[], width = 20): BinRow[] {
  const ways = combinationsBySum();
  const rows: BinRow[] = [];
  for (let from = 21; from <= 255; from += width) {
    const to = Math.min(255, from + width - 1);
    let theory = 0;
    for (let s = from; s <= to; s++) theory += ways[s];
    rows.push({ label: `${from}~${to}`, from, to, count: 0, share: 0, theoretical: theory / TOTAL_COMBINATIONS });
  }
  for (const d of draws) {
    const sum = d.numbers.reduce((a, b) => a + b, 0);
    rows[Math.floor((sum - 21) / width)].count++;
  }
  for (const r of rows) r.share = draws.length ? r.count / draws.length : 0;
  // Bins at the edges hold almost nothing; keep the ones where something happens.
  return rows.filter((r) => r.count > 0 || r.theoretical >= 0.005);
}

// ---- Last digit (끝수) ----

export type DigitRow = { digit: number; count: number; expected: number };

export function lastDigitStats(draws: readonly Draw[]): DigitRow[] {
  const rows = Array.from({ length: 10 }, (_, digit) => {
    const numbersWithDigit = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => n % 10 === digit).length;
    return { digit, count: 0, expected: (draws.length * 6 * numbersWithDigit) / 45 };
  });
  for (const d of draws) for (const n of d.numbers) rows[n % 10].count++;
  return rows;
}

// ---- Consecutive numbers and carry-over from the previous draw ----

export type ShareStat = { count: number; total: number; share: number; theoretical: number };

// Share of draws with at least one consecutive pair (e.g. 12-13). Theory: 1 - C(40,6)/C(45,6).
export function consecutiveShare(draws: readonly Draw[]): ShareStat {
  const count = draws.filter((d) => d.numbers.some((n, i) => i > 0 && n === d.numbers[i - 1] + 1)).length;
  return { count, total: draws.length, share: draws.length ? count / draws.length : 0, theoretical: 1 - comb(40, 6) / TOTAL_COMBINATIONS };
}

// Share of draws repeating at least one main number from the draw before. Theory: 1 - C(39,6)/C(45,6).
export function carryOverShare(drawsDesc: readonly Draw[]): ShareStat {
  let count = 0;
  let total = 0;
  for (let i = 0; i < drawsDesc.length - 1; i++) {
    const prev = new Set(drawsDesc[i + 1].numbers);
    total++;
    if (drawsDesc[i].numbers.some((n) => prev.has(n))) count++;
  }
  return { count, total, share: total ? count / total : 0, theoretical: 1 - comb(39, 6) / TOTAL_COMBINATIONS };
}

// ---- Pairs ----

export type PairStat = { a: number; b: number; count: number };

// Pairs of main numbers drawn together most often. Expected per pair: draws * C(43,4)/C(45,6) = draws / 66.
export function topPairs(draws: readonly Draw[], limit: number): PairStat[] {
  const counts = new Map<number, number>();
  for (const d of draws) {
    const s = d.numbers;
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const key = s[i] * 64 + s[j];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || x[0] - y[0])
    .slice(0, limit)
    .map(([key, count]) => ({ a: Math.floor(key / 64), b: key % 64, count }));
}

export function expectedPairCount(drawCount: number): number {
  return (drawCount * comb(43, 4)) / TOTAL_COMBINATIONS;
}

// ---- One number (번호별 상세) ----

export type NumberDetail = {
  n: number;
  count: number; // as a main number
  bonusCount: number;
  rounds: number[]; // rounds where it was a main number, newest first
  drawsSince: number | null;
  averageGap: number | null; // average draws between appearances
  longestGap: number; // longest run of draws without it (including the current one)
  companions: { n: number; count: number }[]; // numbers drawn together with it most often
  recentCount: number; // appearances in the last HOT_WINDOW draws
};

export function numberDetail(drawsDesc: readonly Draw[], n: number): NumberDetail {
  const rounds: number[] = [];
  let bonusCount = 0;
  const together = new Array(46).fill(0);
  for (const d of drawsDesc) {
    if (d.bonus === n) bonusCount++;
    if (!d.numbers.includes(n)) continue;
    rounds.push(d.round);
    for (const m of d.numbers) if (m !== n) together[m]++;
  }
  const latest = drawsDesc[0]?.round ?? 0;
  const first = drawsDesc[drawsDesc.length - 1]?.round ?? 1;
  let longestGap = 0;
  let prev = latest + 1;
  for (const r of rounds) {
    longestGap = Math.max(longestGap, prev - r - 1);
    prev = r;
  }
  longestGap = Math.max(longestGap, prev - first);
  const asc = [...rounds].reverse();
  const averageGap = asc.length > 1 ? (asc[asc.length - 1] - asc[0]) / (asc.length - 1) : null;
  const companions = together
    .map((count, m) => ({ n: m, count }))
    .filter((c) => c.n >= 1)
    .sort((a, b) => b.count - a.count || a.n - b.n)
    .slice(0, 6);
  const recentFrom = latest - HOT_WINDOW + 1;
  return {
    n,
    count: rounds.length,
    bonusCount,
    rounds,
    drawsSince: rounds.length ? latest - rounds[0] : null,
    averageGap,
    longestGap,
    companions,
    recentCount: rounds.filter((r) => r >= recentFrom).length,
  };
}
