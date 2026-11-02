import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useHydrated } from '@/hooks/use-hydrated';
import { formatCountdown, nextDrawTime } from '@/lib/lotto/schedule';

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "추첨까지 2일 3시간 5분" as small text; for lists. */
export function NextDrawCountdownText() {
  const now = useNow();
  return (
    <ThemedText type="small" themeColor="textSecondary">
      추첨까지 {formatCountdown(nextDrawTime(new Date(now)).getTime() - now)}
    </ThemedText>
  );
}

// Countdown to the next Saturday draw. Client-only (the static HTML shows the schedule instead).
export function NextDrawCountdown() {
  const hydrated = useHydrated();
  const now = useNow();

  if (!hydrated) return <ThemedText style={{ fontSize: 24, lineHeight: 32, fontWeight: '700' }}>매주 토요일</ThemedText>;
  const next = nextDrawTime(new Date(now));
  return (
    <ThemedText style={{ fontSize: 24, lineHeight: 32, fontWeight: '700' }}>
      {formatCountdown(next.getTime() - now)} 남음
    </ThemedText>
  );
}
