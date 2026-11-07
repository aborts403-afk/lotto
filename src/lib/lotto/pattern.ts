// "역대 패턴으로 뽑기": the number-scoring rule that fitted past draws best.
//
// How it was found: 3,000 rules were generated (which recent windows to look at, whether to favor
// frequent or rare numbers, how much the gap since a number's last appearance counts, ...) and
// scored on rounds 51–900 by how many of the next draw's numbers their top six hit. This rule won
// with 0.882 hits per set on those rounds (random: 0.800).
//
// What it means: nothing. On rounds 901–1248, which the search never saw, the same rule hit 0.727
// per set. Rules that fitted the past worst hit 0.806. Past draws carry no information about the
// next one, so the fit was luck. The app ships the rule because people ask for "the numbers the
// data points to", and shows the out-of-sample result next to them (see patternBacktest).

import type { Draw } from './draws';

// Window length → weight on (share of draws in that window containing n − 6/45) · √window.
const WINDOW_WEIGHTS: readonly [number, number][] = [
  [5, -0.343],
  [20, 0.606],
  [30, 0.348],
  [50, 0.003],
  [150, 0.618],
  [300, -0.264],
];
const GAP_WEIGHT = -0.9; // per 8 draws since the number last appeared
const BASE_SHARE = 6 / 45;

export const PATTERN_FIT = { from: 51, to: 900, hits: 0.882 } as const; // rounds the rule was chosen on
export const RANDOM_HITS = 0.8; // expected hits per set for any six numbers: 6 · 6/45
export const BACKTEST_ROUNDS = 348;

// Score of each number 1..45 (index n-1) for the draw after `drawsDesc[0]`; higher = the rule likes it.
export function patternScores(drawsDesc: readonly Draw[]): number[] {
  const scores = new Array<number>(45).fill(0);
  for (const [window, weight] of WINDOW_WEIGHTS) {
    if (!weight) continue;
    const span = Math.min(window, drawsDesc.length);
    if (!span) continue;
    const count = new Array<number>(45).fill(0);
    for (let i = 0; i < span; i++) for (const n of drawsDesc[i].numbers) count[n - 1]++;
    const scale = weight * Math.sqrt(window);
    for (let k = 0; k < 45; k++) scores[k] += scale * (count[k] / window - BASE_SHARE);
  }
  const gap = new Array<number>(45).fill(drawsDesc.length);
  for (let i = drawsDesc.length - 1; i >= 0; i--) for (const n of drawsDesc[i].numbers) gap[n - 1] = i;
  for (let k = 0; k < 45; k++) scores[k] += (GAP_WEIGHT * gap[k]) / 8;
  return scores;
}

// Numbers 1..45 ordered from the rule's favorite down.
export function patternRanking(drawsDesc: readonly Draw[]): number[] {
  const scores = patternScores(drawsDesc);
  return Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => scores[b - 1] - scores[a - 1] || a - b);
}

// The rule's single answer: its six highest-scoring numbers.
export function patternTop6(drawsDesc: readonly Draw[]): number[] {
  return patternRanking(drawsDesc)
    .slice(0, 6)
    .sort((a, b) => a - b);
}

// Sampling weights for the generator (index n-1): rank-based, so the six favorites carry about
// 60% of each pick and sets still differ from one another.
export function patternWeights(drawsDesc: readonly Draw[]): number[] {
  const weights = new Array<number>(45).fill(0);
  patternRanking(drawsDesc).forEach((n, rank) => {
    weights[n - 1] = Math.exp(-rank / 6);
  });
  return weights;
}

export type PatternBacktest = { rounds: number; from: number; to: number; hits: number };

// Hits per set of the rule's top six over the latest `rounds` draws, each predicted from the draws
// before it. These rounds were never used to choose the rule, so this is what it is really worth.
export function patternBacktest(drawsDesc: readonly Draw[], rounds = BACKTEST_ROUNDS): PatternBacktest | null {
  const n = Math.min(rounds, drawsDesc.length - 300);
  if (n < 50) return null;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const pick = patternTop6(drawsDesc.slice(i + 1));
    const drawn = new Set(drawsDesc[i].numbers);
    hits += pick.filter((x) => drawn.has(x)).length;
  }
  return { rounds: n, from: drawsDesc[n - 1].round, to: drawsDesc[0].round, hits: hits / n };
}
