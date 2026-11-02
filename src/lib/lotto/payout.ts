// 1st-prize payout estimates: "if this combination wins, how many people would I share with, and how
// much would I take home?" Winning odds are the same for every combination; only the sharing differs.
import { ticketsSold, TOTAL_COMBINATIONS, type Draw } from './draws';
import {
  lessPopularThanPercent,
  patternFlags,
  popularityScore,
  randomCombo,
  seededRng,
  type Combo,
  type PatternFlag,
} from './generator';
import { NUMBER_WEIGHTS } from './popularity-weights';

// The popularity model (analysis/popularity.py) is fitted on 3rd-prize winners. On held-out draws its
// spread is narrower for 1st-prize sharing (lowest/highest quartile 0.95x/1.08x vs 0.90x/1.10x raw),
// so multipliers are shrunk toward 1 to stay conservative.
const SHRINK = 0.6;

let normalizer: number | null = null;
function meanRawMultiplier(): number {
  if (normalizer === null) {
    const rng = seededRng(7);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += Math.exp(popularityScore(randomCombo(rng)));
    normalizer = sum / n;
  }
  return normalizer;
}

/** How many times more (or fewer) players than an average combination are expected to pick this one. */
export function popularityMultiplier(combo: Combo): number {
  const raw = Math.exp(popularityScore(combo)) / meanRawMultiplier();
  return 1 + SHRINK * (raw - 1);
}

// Korean lottery prize tax: none up to 2,000,000 KRW, 22% up to 300,000,000, 33% on the part above.
export function afterTax(prize: number): number {
  if (prize <= 2_000_000) return prize;
  if (prize <= 300_000_000) return prize * 0.78;
  return 300_000_000 * 0.78 + (prize - 300_000_000) * 0.67;
}

// E[1 / (1 + K)] for K ~ Poisson(λ): your expected share of the pool when λ others are expected to win too.
function expectedShare(lambda: number): number {
  return lambda < 1e-9 ? 1 : (1 - Math.exp(-lambda)) / lambda;
}

const BASIS_DRAWS = 52;

export type PayoutEstimate = {
  multiplier: number; // vs an average combination
  others: number; // expected number of other 1st-prize winners on the same combination
  gross: number; // expected 1st prize before tax, KRW
  net: number; // after tax
  averageNet: number; // the same for an average combination
  basis: { from: number; to: number; draws: number };
};

/**
 * Expected 1st prize for this combination, averaged over recent draws (their sales and 1st-prize pools).
 * Draws without a 1st-prize winner are skipped (their pool is not published).
 */
export function estimatePayout(combo: Combo, drawsDesc: readonly Draw[]): PayoutEstimate {
  const basis = drawsDesc
    .slice(0, BASIS_DRAWS * 2)
    .filter((d) => d.ranks[0].winners > 0)
    .slice(0, BASIS_DRAWS);
  const m = popularityMultiplier(combo);
  let gross = 0;
  let net = 0;
  let averageNet = 0;
  let others = 0;
  for (const d of basis) {
    const pool = d.ranks[0].prize * d.ranks[0].winners;
    const lambda = ticketsSold(d) / TOTAL_COMBINATIONS;
    const mine = pool * expectedShare(lambda * m);
    gross += mine;
    net += afterTax(mine);
    averageNet += afterTax(pool * expectedShare(lambda));
    others += lambda * m;
  }
  const n = basis.length || 1;
  return {
    multiplier: m,
    others: others / n,
    gross: gross / n,
    net: net / n,
    averageNet: averageNet / n,
    basis: { from: basis[basis.length - 1]?.round ?? 0, to: basis[0]?.round ?? 0, draws: basis.length },
  };
}

export type Diagnosis = {
  lessPopularThan: number; // share (0..100) of random combinations estimated MORE popular than this one
  morePopularThan: number; // 100 - lessPopularThan
  verdict: 'popular' | 'average' | 'unpopular';
  reasons: string[];
  popularNumbers: number[]; // numbers in the combination that players pick often
  quietNumbers: number[]; // numbers in it that players pick less often
};

const PATTERN_TEXT: Record<PatternFlag, string> = {
  run3: '연속된 번호가 3개 이상 있어요. 일부러 이어서 고르는 사람이 많아요.',
  arithmetic5: '같은 간격으로 늘어선 번호가 5개 이상이에요. 규칙적인 모양은 많이 골라요.',
  slipLine: '용지의 한 줄(가로·세로·대각선)에 번호가 4개 이상 몰려 있어요.',
  allBirthday: '6개가 모두 31 이하예요. 생일·기념일로 고르는 사람이 많아요.',
  sameLastDigit3: '끝자리가 같은 번호가 3개 이상이에요.',
};

// Numbers ranked by estimated popularity (index 0 = most picked).
const BY_POPULARITY = Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => NUMBER_WEIGHTS[b - 1] - NUMBER_WEIGHTS[a - 1]);
const POPULAR_SET = new Set(BY_POPULARITY.slice(0, 12));
const QUIET_SET = new Set(BY_POPULARITY.slice(-12));

export function diagnose(combo: Combo): Diagnosis {
  const lessPopularThan = lessPopularThanPercent(combo);
  const morePopularThan = 100 - lessPopularThan;
  const popularNumbers = combo.filter((n) => POPULAR_SET.has(n));
  const quietNumbers = combo.filter((n) => QUIET_SET.has(n));
  const reasons = patternFlags(combo).map((f) => PATTERN_TEXT[f]);
  if (popularNumbers.length >= 2) {
    reasons.push(`${popularNumbers.join(', ')}처럼 많은 사람이 좋아하는 번호가 ${popularNumbers.length}개 있어요.`);
  }
  if (quietNumbers.length >= 2) {
    reasons.push(`${quietNumbers.join(', ')}는 사람들이 덜 고르는 번호라 도움이 돼요.`);
  }
  if (!combo.some((n) => n > 31) && !reasons.some((r) => r.includes('31 이하'))) {
    reasons.push('32 이상 큰 번호가 없어요. 큰 번호를 섞으면 겹칠 사람이 줄어요.');
  }
  return {
    lessPopularThan,
    morePopularThan,
    verdict: morePopularThan >= 70 ? 'popular' : lessPopularThan >= 70 ? 'unpopular' : 'average',
    reasons,
    popularNumbers,
    quietNumbers,
  };
}
