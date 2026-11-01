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
