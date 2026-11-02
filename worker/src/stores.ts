// Winning-store summary (GET /api/stores/summary): store rankings by 1st-prize wins, per region.
// The web build bundles this into src/data/stores.json (scripts/sync-draws.mts).

export const INTERNET_STORE_ID = '51100000';
const INTERNET = '인터넷';

// Region of a winning ticket. dhlottery labels Gwangju and Jeonnam together for older rows
// ("전남광주") and separately for newer ones, so they are merged. Blank = unknown (old rows).
export function normalizeRegion(storeId: string | null, region: string | null): string | null {
  if (storeId === INTERNET_STORE_ID) return INTERNET;
  const r = (region ?? '').trim();
  if (!r) return null;
  if (r === '광주' || r === '전남' || r === '전남광주') return '광주·전남';
  return r;
}

export type StoreSummaryRow = {
  id: string;
  name: string;
  address: string | null;
  region: string | null;
  closed: boolean;
  first: number; // 1st-prize tickets
  second: number; // 2nd-prize tickets
  auto: number; // 1st-prize tickets by pick type
  manual: number;
  semiAuto: number;
  firstRounds: number[]; // newest first
};

export type RegionSummary = { region: string; first: number; second: number; stores: number };

export type StoresSummary = {
  fromRound: number;
  toRound: number;
  firstTickets: number;
  firstStores: number; // stores with at least one 1st prize
  repeatStores: number; // stores with 2+ 1st prizes
  regions: RegionSummary[];
  top: StoreSummaryRow[]; // overall, by 1st prizes
  byRegion: Record<string, StoreSummaryRow[]>;
};

const TOP_OVERALL = 30;
const TOP_PER_REGION = 15;

type AggRow = {
  store_id: string;
  store_name: string | null;
  address: string | null;
  region: string | null;
  status: string | null;
  first: number;
  second: number;
  auto: number;
  manual: number;
  semi: number;
  rounds1: string | null;
};

export async function storesSummary(db: D1Database): Promise<StoresSummary> {
  // One row per store with any 1st or 2nd prize; name and address from its most recent win.
  const { results } = await db
    .prepare(
      `WITH latest AS (
         SELECT store_id, store_name, address, region, status,
                ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY round DESC, rank, seq) AS rn
           FROM winning_tickets
       ),
       agg AS (
         SELECT store_id,
                SUM(rank = 1) AS first, SUM(rank = 2) AS second,
                SUM(rank = 1 AND pick_type = '자동') AS auto,
                SUM(rank = 1 AND pick_type = '수동') AS manual,
                SUM(rank = 1 AND pick_type = '반자동') AS semi,
                GROUP_CONCAT(CASE WHEN rank = 1 THEN round END) AS rounds1
           FROM winning_tickets GROUP BY store_id
       )
       SELECT a.*, l.store_name, l.address, l.region, l.status
         FROM agg a JOIN latest l ON l.store_id = a.store_id AND l.rn = 1`,
    )
    .all<AggRow>();
  const range = await db
    .prepare('SELECT MIN(round) AS fromRound, MAX(round) AS toRound FROM winning_tickets')
    .first<{ fromRound: number; toRound: number }>();
  return summarize(results, range?.fromRound ?? 0, range?.toRound ?? 0);
}

export function summarize(rows: readonly AggRow[], fromRound: number, toRound: number): StoresSummary {
  const stores: StoreSummaryRow[] = rows
    .filter((r) => r.store_id)
    .map((r) => ({
      id: r.store_id,
      name: r.store_id === INTERNET_STORE_ID ? '동행복권 인터넷 판매' : (r.store_name ?? '').trim() || '(이름 없음)',
      address: r.store_id === INTERNET_STORE_ID ? null : (r.address ?? '').trim() || null,
      region: normalizeRegion(r.store_id, r.region),
      closed: r.status === '폐점',
      first: r.first,
      second: r.second,
      auto: r.auto,
      manual: r.manual,
      semiAuto: r.semi,
      firstRounds: (r.rounds1 ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number)
        .sort((a, b) => b - a),
    }));
  const byWins = (a: StoreSummaryRow, b: StoreSummaryRow) =>
    b.first - a.first || b.second - a.second || (b.firstRounds[0] ?? 0) - (a.firstRounds[0] ?? 0);
  stores.sort(byWins);

  const regionMap = new Map<string, RegionSummary>();
  for (const s of stores) {
    if (!s.region) continue;
    const r = regionMap.get(s.region) ?? { region: s.region, first: 0, second: 0, stores: 0 };
    r.first += s.first;
    r.second += s.second;
    if (s.first > 0) r.stores++;
    regionMap.set(s.region, r);
  }
  const regions = [...regionMap.values()].sort((a, b) => b.first - a.first);

  const winners = stores.filter((s) => s.first > 0);
  const byRegion: Record<string, StoreSummaryRow[]> = {};
  for (const r of regions) {
    if (r.region === INTERNET) continue;
    byRegion[r.region] = winners.filter((s) => s.region === r.region).slice(0, TOP_PER_REGION);
  }
  return {
    fromRound,
    toRound,
    firstTickets: winners.reduce((sum, s) => sum + s.first, 0),
    firstStores: winners.length,
    repeatStores: winners.filter((s) => s.first >= 2).length,
    regions,
    top: winners.slice(0, TOP_OVERALL),
    byRegion,
  };
}
