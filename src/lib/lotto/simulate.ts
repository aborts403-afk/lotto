// "그때부터 샀다면": one ticket with the same numbers in every draw of a period, settled against the
// real results (prizes are what was actually paid per winner in each draw).
import { checkTicket, type Rank } from './check';
import type { Draw } from './draws';

export type SimulationResult = {
  draws: number;
  fromRound: number;
  toRound: number;
  spent: number; // KRW (2,000 per ticket until round 87, 1,000 since)
  won: number; // KRW before tax
  returnRate: number; // won / spent - 1
  counts: Record<Rank, number>;
  best: { round: number; matched: number; bonus: boolean; rank: Rank | null } | null; // the closest call
  firstWins: number[]; // rounds this ticket would have won the 1st prize
};

/** drawsDesc: newest first; `period` = how many recent draws to use (null = all). */
export function simulate(numbers: readonly number[], drawsDesc: readonly Draw[], period: number | null): SimulationResult {
  const used = period === null ? drawsDesc : drawsDesc.slice(0, period);
  const counts: Record<Rank, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let spent = 0;
  let won = 0;
  let best: SimulationResult['best'] = null;
  const firstWins: number[] = [];
  const sorted = [...numbers].sort((a, b) => a - b);
  for (const d of used) {
    spent += d.round < 88 ? 2000 : 1000;
    const r = checkTicket(sorted, d);
    if (r.rank) {
      counts[r.rank]++;
      won += r.prize;
      if (r.rank === 1) firstWins.push(d.round);
    }
    const score = r.matched.length + (r.bonusMatched ? 0.5 : 0);
    const bestScore = best ? best.matched + (best.bonus ? 0.5 : 0) : -1;
    // Ties go to the more recent draw (drawsDesc is newest first, so keep the first one found).
    if (score > bestScore) best = { round: d.round, matched: r.matched.length, bonus: r.bonusMatched, rank: r.rank };
  }
  return {
    draws: used.length,
    fromRound: used[used.length - 1]?.round ?? 0,
    toRound: used[0]?.round ?? 0,
    spent,
    won,
    returnRate: spent ? won / spent - 1 : 0,
    counts,
    best,
    firstWins,
  };
}
