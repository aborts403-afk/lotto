import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { DRAWS_DESC, getDraw, LATEST_DRAW, type Draw } from '@/lib/lotto/draws';
import { drawTimeOfRound } from '@/lib/lotto/schedule';
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
// since the build are fetched at start and shared by every screen. They are fetched again:
//  - when the app (or browser tab) comes back to the foreground after a while, and
//  - every few minutes while a draw has happened but its results are not in yet,
// so an app left open since before Saturday's draw still shows the results.
let fresh: readonly Draw[] = []; // newest first, all newer than LATEST_DRAW
let inFlight = false;
let lastFetch = 0;
let watching = false;
const listeners = new Set<() => void>();

const MIN_GAP = 60_000; // never fetch more often than this
const FOREGROUND_STALE = 30 * 60_000; // on returning to the foreground, refetch if older than this
const DUE_POLL = 5 * 60_000; // results due (draw time passed): poll this often
const LATE_POLL = 30 * 60_000; // more than 6 hours late (e.g. a postponed draw): poll less

function weeksSinceBundle(): number {
  const bundled = Date.parse(`${LATEST_DRAW.drawDate}T21:00:00+09:00`);
  return Math.max(0, Math.ceil((Date.now() - bundled) / (7 * 86_400_000)));
}

// Milliseconds since the next round's draw time; negative before the draw.
function msSinceNextDraw(): number {
  const newest = fresh[0] ?? LATEST_DRAW;
  return Date.now() - drawTimeOfRound(newest.round + 1, newest).getTime();
}

function refresh() {
  if (inFlight || Date.now() - lastFetch < MIN_GAP) return;
  inFlight = true;
  lastFetch = Date.now();
  const limit = Math.min(weeksSinceBundle() + 2, 520);
  fetch(`${SITE_URL}/api/draws?limit=${limit}`)
    .then((res) => (res.ok ? (res.json() as Promise<ApiDraw[]>) : Promise.reject(new Error(String(res.status)))))
    .then((rows) => {
      const next = rows
        .filter((d) => d.round > LATEST_DRAW.round)
        .sort((x, y) => y.round - x.round)
        .map((d) => ({
          round: d.round,
          drawDate: d.drawDate,
          numbers: d.numbers,
          bonus: d.bonus,
          ranks: d.ranks.map((r) => ({ winners: r.winners, prize: r.prize })),
          totalSales: d.totalSales,
          firstPrizePickTypes: d.firstPrizePickTypes,
        }));
      if (next.length !== fresh.length || next[0]?.round !== fresh[0]?.round) {
        fresh = next;
        listeners.forEach((l) => l());
      }
    })
    .catch(() => {
      lastFetch = 0; // offline or API down: keep what we have and allow the next attempt right away
    })
    .finally(() => {
      inFlight = false;
    });
}

function startWatching() {
  if (watching) return;
  watching = true;
  refresh();
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    if (msSinceNextDraw() >= 0 || Date.now() - lastFetch >= FOREGROUND_STALE) refresh();
  });
  setInterval(() => {
    if (AppState.currentState !== 'active') return;
    const since = msSinceNextDraw();
    if (since < 0) return;
    if (Date.now() - lastFetch >= (since < 6 * 3600_000 ? DUE_POLL : LATE_POLL)) refresh();
  }, 60_000);
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
    if (hydrated) startWatching();
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
