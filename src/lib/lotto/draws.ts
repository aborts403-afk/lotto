// Past draws bundled at build time (scripts/sync-draws.mts writes src/data/draws.json).
import rawRows from '@/data/draws.json';

export type Draw = {
  round: number;
  drawDate: string; // YYYY-MM-DD (KST)
  numbers: readonly number[]; // 6 sorted
  bonus: number;
  ranks: readonly { winners: number; prize: number }[]; // index 0 = 1st prize; prize is per winner (KRW)
  totalSales: number; // KRW
};

type Row = (string | number)[];

// Row: [round, drawDate, n1..n6, bonus, rank1Winners, rank1Prize, ..., rank5Winners, rank5Prize, totalSales]
function decodeRow(r: Row): Draw {
  const n = (i: number) => r[i] as number;
  return {
    round: n(0),
    drawDate: r[1] as string,
    numbers: [n(2), n(3), n(4), n(5), n(6), n(7)],
    bonus: n(8),
    ranks: [0, 1, 2, 3, 4].map((k) => ({ winners: n(9 + k * 2), prize: n(10 + k * 2) })),
    totalSales: n(19),
  };
}

const ASC: readonly Draw[] = (rawRows as Row[]).map(decodeRow);
const BY_ROUND = new Map(ASC.map((d) => [d.round, d]));

export const DRAWS_DESC: readonly Draw[] = [...ASC].reverse();
export const LATEST_DRAW: Draw = ASC[ASC.length - 1];

export function getDraw(round: number): Draw | undefined {
  return BY_ROUND.get(round);
}

export const TOTAL_COMBINATIONS = 8_145_060; // C(45, 6)

// Tickets cost 2,000 KRW until round 87 and 1,000 KRW since round 88.
export function ticketsSold(d: Draw): number {
  return d.totalSales / (d.round < 88 ? 2000 : 1000);
}

// Draws are uniform, so the expected number of 1st-prize winners is tickets / C(45,6)
// no matter how players pick. More winners than that means the combination was a popular pick.
export function expectedFirstWinners(d: Draw): number {
  return ticketsSold(d) / TOTAL_COMBINATIONS;
}

export type Sharing = 'popular' | 'average' | 'unpopular';

// Compares actual and expected 1st-prize winners with a Poisson z-score, so small counts
// are not over-interpreted (|z| > 2 is roughly a 5% chance under "average popularity").
export function firstPrizeSharing(d: Draw): { expected: number; ratio: number; z: number; verdict: Sharing } {
  const expected = expectedFirstWinners(d);
  const actual = d.ranks[0].winners;
  const z = (actual - expected) / Math.sqrt(expected);
  const verdict: Sharing = z > 2 ? 'popular' : z < -2 ? 'unpopular' : 'average';
  return { expected, ratio: actual / expected, z, verdict };
}
