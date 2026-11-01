import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { useHydrated } from '@/hooks/use-hydrated';
import { formatCountdown, nextDrawTime } from '@/lib/lotto/schedule';

// Countdown to the next Saturday draw. Client-only (the static HTML shows the schedule instead).
export function NextDrawCountdown() {
  const hydrated = useHydrated();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!hydrated) return <ThemedText style={{ fontSize: 24, lineHeight: 32, fontWeight: '700' }}>매주 토요일</ThemedText>;
  const next = nextDrawTime(new Date(now));
  return (
    <ThemedText style={{ fontSize: 24, lineHeight: 32, fontWeight: '700' }}>
      {formatCountdown(next.getTime() - now)} 남음
    </ThemedText>
  );
}
