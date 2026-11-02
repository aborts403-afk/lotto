// Draws are every Saturday around 20:35 KST (UTC+9).
const KST_OFFSET_MS = 9 * 3600_000;
const DRAW_HOUR = 20;
const DRAW_MINUTE = 35;

// Next draw time after `now` (as a Date). If the draw is happening right now, returns this week's.
export function nextDrawTime(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS); // read with getUTC* = KST wall clock
  const daysUntilSat = (6 - kst.getUTCDay() + 7) % 7;
  const candidate = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + daysUntilSat, DRAW_HOUR, DRAW_MINUTE) - KST_OFFSET_MS;
  return new Date(candidate > now.getTime() ? candidate : candidate + 7 * 86_400_000);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}일 ${h}시간 ${m}분`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

// Draw time of a round, counted in weeks from a known draw (every round is one week apart).
export function drawTimeOfRound(round: number, known: { round: number; drawDate: string }): Date {
  const base = Date.parse(`${known.drawDate}T${String(DRAW_HOUR).padStart(2, '0')}:${String(DRAW_MINUTE).padStart(2, '0')}:00+09:00`);
  return new Date(base + (round - known.round) * 7 * 86_400_000);
}
