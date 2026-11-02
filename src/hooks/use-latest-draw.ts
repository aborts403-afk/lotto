import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { DRAWS_DESC, getDraw, LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
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

// Draws newer than the bundled data (src/data/draws.json is written at build time). The web build is
// redeployed after every draw, but an installed app keeps its bundle until it is updated, so the rounds
// since the build are fetched once per session and shared by every screen.
let fresh: readonly Draw[] = []; // newest first, all newer than LATEST_DRAW
let started = false;
const listeners = new Set<() => void>();

function weeksSinceBundle(): number {
  const bundled = Date.parse(`${LATEST_DRAW.drawDate}T21:00:00+09:00`);
  return Math.max(0, Math.ceil((Date.now() - bundled) / (7 * 86_400_000)));
}

function loadFresh() {
  if (started) return;
  started = true;
  const limit = Math.min(weeksSinceBundle() + 2, 520);
  fetch(`${SITE_URL}/api/draws?limit=${limit}`)
    .then((res) => (res.ok ? (res.json() as Promise<ApiDraw[]>) : []))
    .then((rows) => {
      fresh = rows
        .filter((d) => d.round > LATEST_DRAW.round)
        .sort((a, b) => b.round - a.round)
        .map((d) => ({
          round: d.round,
          drawDate: d.drawDate,
          numbers: d.numbers,
          bonus: d.bonus,
          ranks: d.ranks.map((r) => ({ winners: r.winners, prize: r.prize })),
          totalSales: d.totalSales,
          firstPrizePickTypes: d.firstPrizePickTypes,
        }));
      if (fresh.length) listeners.forEach((l) => l());
    })
    .catch(() => {
      started = false; // offline or API down: keep the bundled draws, retry on the next mount
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getFresh = () => fresh;
const getNone = (): readonly Draw[] => [];

function useFreshDraws(): readonly Draw[] {
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated) loadFresh();
  }, [hydrated]);
  // During web static rendering there is nothing fetched yet, so the server snapshot is empty.
  return useSyncExternalStore(subscribe, getFresh, getNone);
}

/** The newest draw, including rounds published after this build. */
export function useLatestDraw(): Draw {
  return useFreshDraws()[0] ?? LATEST_DRAW;
}

/** Looks up any round, including rounds published after this build. */
export function useDrawLookup(): (round: number) => Draw | undefined {
  const freshDraws = useFreshDraws();
  return useCallback((round: number) => getDraw(round) ?? freshDraws.find((d) => d.round === round), [freshDraws]);
}

/** All draws, newest first, including rounds published after this build. */
export function useAllDraws(): readonly Draw[] {
  const freshDraws = useFreshDraws();
  return useMemo(() => (freshDraws.length ? [...freshDraws, ...DRAWS_DESC] : DRAWS_DESC), [freshDraws]);
}
