import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLatestDraw } from '@/hooks/use-latest-draw';
import { drawTimeOfRound, formatCountdown, nextDrawTime } from '@/lib/lotto/schedule';

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type PendingPhase = 'before' | 'checking' | 'late';

// Where a round without results stands: before its draw, just drawn (results are usually collected
// within 10~30 minutes), or late (more than 6 hours after the draw and still nothing).
export function usePendingRound(round: number): { phase: PendingPhase; msToDraw: number } {
  const latest = useLatestDraw();
  const now = useNow();
  const msToDraw = drawTimeOfRound(round, latest).getTime() - now;
  const phase: PendingPhase = msToDraw > 0 ? 'before' : msToDraw > -6 * 3600_000 ? 'checking' : 'late';
  return { phase, msToDraw };
}

/** Status line for a round without results: countdown before the draw, "checking" after it. */
export function PendingRoundText({ round }: { round: number }) {
  const { phase, msToDraw } = usePendingRound(round);
  const text =
    phase === 'before'
      ? `추첨까지 ${formatCountdown(msToDraw)}`
      : phase === 'checking'
        ? '추첨이 끝났어요. 결과를 확인하는 중이에요 (보통 10~30분)'
        : '결과가 늦어지고 있어요. 잠시 후 다시 확인해 주세요';
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {text}
    </ThemedText>
  );
}

// Countdown to the next Saturday draw. Client-only (the static HTML shows the schedule instead).
export function NextDrawCountdown() {
  const hydrated = useHydrated();
  const now = useNow();

  if (!hydrated) return <ThemedText type="heading">매주 토요일</ThemedText>;
  const next = nextDrawTime(new Date(now));
  return <ThemedText type="heading">{formatCountdown(next.getTime() - now)} 남음</ThemedText>;
}
