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

export type TicketQr = { round: number; games: number[][] };

/**
 * Reads the QR code printed on a Lotto 6/45 ticket, e.g.
 * https://m.dhlottery.co.kr/qr.do?method=winQr&v=1125m152023263944m070827293643…0000000645
 * `v` = 4-digit round, then one letter + 12 digits (six 2-digit numbers) per game, then a serial that
 * is ignored. dhlottery does not publish this format; it is inferred from real ticket URLs.
 * Returns null when the text is not a ticket QR or a game is not six distinct numbers 1..45.
 */
export function parseTicketQr(text: string): TicketQr | null {
  const v = /[?&]v=([0-9a-z]+)/i.exec(text.trim())?.[1];
  if (!v) return null;
  const round = Number(v.slice(0, 4));
  if (!/^\d{4}$/.test(v.slice(0, 4)) || round < 1) return null;
  const games: number[][] = [];
  for (const m of v.slice(4).matchAll(/[a-z](\d{12})/gi)) {
    const nums = (m[1].match(/\d{2}/g) ?? []).map(Number);
    if (nums.some((n) => n < 1 || n > 45) || new Set(nums).size !== 6) return null;
    games.push(nums.sort((a, b) => a - b));
    if (games.length === 5) break; // a ticket holds at most five games (A–E)
  }
  return games.length ? { round, games } : null;
}
