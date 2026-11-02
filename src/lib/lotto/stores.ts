// Winning-store rankings bundled at build time (scripts/sync-draws.mts writes src/data/stores.json from
// /api/stores/summary; the shape is defined in worker/src/stores.ts).
import raw from '@/data/stores.json';

import { LATEST_DRAW } from './draws';

export type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  region: string | null;
  closed: boolean;
  first: number;
  second: number;
  auto: number;
  manual: number;
  semiAuto: number;
  firstRounds: number[]; // newest first; a round repeats when one store sold several 1st-prize tickets
};

export type RegionRow = { region: string; first: number; second: number; stores: number };

export type StoresSummary = {
  fromRound: number;
  toRound: number;
  firstTickets: number;
  firstStores: number;
  repeatStores: number;
  regions: RegionRow[];
  top: StoreRow[];
  byRegion: Record<string, StoreRow[]>;
};

export const STORES = raw as StoresSummary;

export const INTERNET_STORE_ID = '51100000';

// A ticket row from GET /api/draws/:round/stores.
export type WinningTicket = {
  rank: 1 | 2;
  seq: number;
  storeId: string | null;
  storeName: string | null;
  address: string | null;
  region: string | null;
  pickType: string | null;
  isInternet: boolean;
  status: string | null;
  lat: number | null;
  lng: number | null;
};

export const INTERNET_REGION = '인터넷';

// Same rule as worker/src/stores.ts: dhlottery labels Gwangju and Jeonnam together for older rows
// ("전남광주") and separately for newer ones, so they are merged; internet sales get their own region.
export function normalizeRegion(storeId: string | null, region: string | null): string | null {
  if (storeId === INTERNET_STORE_ID) return INTERNET_REGION;
  const r = (region ?? '').trim();
  if (!r) return null;
  if (r === '광주' || r === '전남' || r === '전남광주') return '광주·전남';
  return r;
}

// Display order for region filters: capital area first, then roughly north to south.
const REGION_ORDER = [
  '서울',
  '경기',
  '인천',
  '강원',
  '대전',
  '세종',
  '충북',
  '충남',
  '대구',
  '경북',
  '부산',
  '울산',
  '경남',
  '광주·전남',
  '전북',
  '제주',
  INTERNET_REGION,
];

export function regionRank(region: string): number {
  const i = REGION_ORDER.indexOf(region);
  return i < 0 ? REGION_ORDER.length - 1 : i;
}

// Winning stores of rounds up to this one are bundled as static files at build time
// (public/data/stores/<round>.json, written by scripts/sync-draws.mts); later rounds can still change,
// so they come from the API. Keep STORE_RECENT_ROUNDS in sync with the build script and the Worker.
const STORE_RECENT_ROUNDS = 4;
export const STATIC_STORES_THROUGH = LATEST_DRAW.round - STORE_RECENT_ROUNDS;
