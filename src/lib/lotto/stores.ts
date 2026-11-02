// Winning-store rankings bundled at build time (scripts/sync-draws.mts writes src/data/stores.json from
// /api/stores/summary; the shape is defined in worker/src/stores.ts).
import raw from '@/data/stores.json';

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
};
