// Ticket checking: which prize a 6-number ticket won in a draw.
import type { Draw } from './draws';

export type Rank = 1 | 2 | 3 | 4 | 5;

export type CheckResult = {
  matched: number[]; // ticket numbers that are among the six winning numbers
  bonusMatched: boolean;
  rank: Rank | null;
  prize: number; // KRW per winning ticket, 0 when no prize
};

export function checkTicket(numbers: readonly number[], draw: Draw): CheckResult {
  const winning = new Set(draw.numbers);
  const matched = numbers.filter((n) => winning.has(n));
  const bonusMatched = numbers.includes(draw.bonus);
  const k = matched.length;
  const rank: Rank | null = k === 6 ? 1 : k === 5 && bonusMatched ? 2 : k === 5 ? 3 : k === 4 ? 4 : k === 3 ? 5 : null;
  return { matched, bonusMatched: rank === 2, rank, prize: rank ? draw.ranks[rank - 1].prize : 0 };
}

export const RANK_RULES: Record<Rank, string> = {
  1: '6개 번호 일치',
  2: '5개 번호 + 보너스 번호 일치',
  3: '5개 번호 일치',
  4: '4개 번호 일치',
  5: '3개 번호 일치',
};

// Parses "3, 11 24-30 41/45" style input into distinct numbers 1..45 (order kept, max 6).
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.match(/\d+/g) ?? []) {
    const n = Number(m);
    if (n >= 1 && n <= 45 && !out.includes(n)) out.push(n);
    if (out.length === 6) break;
  }
  return out;
}
