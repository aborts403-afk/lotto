import { useEffect, useState } from 'react';

import { LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
import { SITE_URL } from '@/lib/site';
import { useHydrated } from './use-hydrated';

type ApiDraw = {
  round: number;
  drawDate: string;
  numbers: number[];
  bonus: number;
  ranks: { winners: number; prize: number }[];
  totalSales: number;
  firstPrizePickTypes: { auto: number; manual: number; semiAuto: number } | null;
};

/**
 * The newest draw: the one bundled at build time, replaced by /api/latest when the API already has a
 * newer round (e.g. right after Saturday's draw, before the site is rebuilt or the app is updated).
 */
export function useLatestDraw(): Draw {
  const hydrated = useHydrated();
  const [fresh, setFresh] = useState<Draw | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch(`${SITE_URL}/api/latest`)
      .then((res) => (res.ok ? (res.json() as Promise<ApiDraw>) : null))
      .then((d) => {
        if (cancelled || !d || d.round <= LATEST_DRAW.round) return;
        setFresh({
          round: d.round,
          drawDate: d.drawDate,
          numbers: d.numbers,
          bonus: d.bonus,
          ranks: d.ranks.map((r) => ({ winners: r.winners, prize: r.prize })),
          totalSales: d.totalSales,
          firstPrizePickTypes: d.firstPrizePickTypes,
        });
      })
      .catch(() => {}); // offline or API down: keep the bundled draw
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  return fresh ?? LATEST_DRAW;
}
