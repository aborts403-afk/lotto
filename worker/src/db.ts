import type { Draw, WinningTicket } from './dhlottery';

export type DrawRow = {
  round: number;
  draw_date: string;
  n1: number; n2: number; n3: number; n4: number; n5: number; n6: number;
  bonus: number;
  rank1_winners: number; rank1_prize: number; rank1_total_prize: number | null;
  rank2_winners: number; rank2_prize: number; rank2_total_prize: number | null;
  rank3_winners: number; rank3_prize: number; rank3_total_prize: number | null;
  rank4_winners: number; rank4_prize: number; rank4_total_prize: number | null;
  rank5_winners: number; rank5_prize: number; rank5_total_prize: number | null;
  total_sales: number;
  prize_pool: number | null;
  total_winners: number | null;
  win_type0: number | null;
  auto_winners: number | null;
  manual_winners: number | null;
  semi_auto_winners: number | null;
  game_seq: number | null;
  excel_rank: string | null;
};

export const DRAW_COLUMNS = [
  'round', 'draw_date', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'bonus',
  'rank1_winners', 'rank1_prize', 'rank1_total_prize',
  'rank2_winners', 'rank2_prize', 'rank2_total_prize',
  'rank3_winners', 'rank3_prize', 'rank3_total_prize',
  'rank4_winners', 'rank4_prize', 'rank4_total_prize',
  'rank5_winners', 'rank5_prize', 'rank5_total_prize',
  'total_sales', 'prize_pool', 'total_winners',
  'win_type0', 'auto_winners', 'manual_winners', 'semi_auto_winners', 'game_seq', 'excel_rank',
] as const;

export function drawValues(d: Draw): (string | number | null)[] {
  return [
    d.round, d.drawDate, ...d.numbers, d.bonus,
    ...d.ranks.flatMap((r) => [r.winners, r.prize, r.totalPrize]),
    d.totalSales, d.prizePool, d.totalWinners,
    d.winType0, d.autoWinners, d.manualWinners, d.semiAutoWinners, d.gameSeq, d.excelRank,
  ];
}

// Upsert: a re-fetched round overwrites every column (keeps fetched_at of the first insert).
export const UPSERT_DRAW_SQL = `INSERT INTO draws (${DRAW_COLUMNS.join(', ')})
  VALUES (${DRAW_COLUMNS.map(() => '?').join(', ')})
  ON CONFLICT(round) DO UPDATE SET ${DRAW_COLUMNS.filter((c) => c !== 'round').map((c) => `${c} = excluded.${c}`).join(', ')}`;

export function upsertDrawStmt(db: D1Database, d: Draw): D1PreparedStatement {
  return db.prepare(UPSERT_DRAW_SQL).bind(...drawValues(d));
}

export const TICKET_COLUMNS = [
  'round', 'rank', 'seq', 'game_code', 'store_id', 'store_name', 'trade_name', 'prev_store_name', 'status',
  'road_name', 'detail_address', 'road_address', 'road_detail_address', 'prev_address', 'address',
  'prev_road_name', 'phone', 'region', 'pick_type_code', 'pick_type', 'operation_status_code',
  'sells_lotto645', 'sells_st5', 'sells_st10', 'sells_st20', 'sells_pension720', 'lat', 'lng',
] as const;

export function ticketValues(t: WinningTicket): (string | number | null)[] {
  return [
    t.round, t.rank, t.seq, t.gameCode, t.storeId, t.storeName, t.tradeName, t.prevStoreName, t.status,
    t.roadName, t.detailAddress, t.roadAddress, t.roadDetailAddress, t.prevAddress, t.address,
    t.prevRoadName, t.phone, t.region, t.pickTypeCode, t.pickType, t.operationStatusCode,
    t.sellsLotto645, t.sellsSt5, t.sellsSt10, t.sellsSt20, t.sellsPension720, t.lat, t.lng,
  ];
}

export const INSERT_TICKET_SQL = `INSERT INTO winning_tickets (${TICKET_COLUMNS.join(', ')})
  VALUES (${TICKET_COLUMNS.map(() => '?').join(', ')})`;

// Replace all tickets of one round+rank (the source list is authoritative and may be re-ordered).
export function replaceTicketsStmts(db: D1Database, round: number, rank: number, tickets: WinningTicket[]): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM winning_tickets WHERE round = ? AND rank = ?').bind(round, rank),
    ...tickets.map((t) => db.prepare(INSERT_TICKET_SQL).bind(...ticketValues(t))),
  ];
}

export async function latestRound(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT MAX(round) AS r FROM draws').first<{ r: number | null }>();
  return row?.r ?? 0;
}

// The WHERE skips the row write when the value is unchanged (D1 bills rows written).
export function setMetaStmt(db: D1Database, key: string, value: string): D1PreparedStatement {
  return db
    .prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value != excluded.value',
    )
    .bind(key, value);
}

export async function setMeta(db: D1Database, key: string, value: string): Promise<void> {
  await setMetaStmt(db, key, value).run();
}

// Large cached values kept in meta (not status), left out of getMeta / the health response.
export const STORES_SUMMARY_KEY = 'stores_summary';

export async function getMetaValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function getMeta(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db
    .prepare('SELECT key, value FROM meta WHERE key != ?')
    .bind(STORES_SUMMARY_KEY)
    .all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

function hasPickBreakdown(row: DrawRow): boolean {
  if (row.auto_winners === null || row.manual_winners === null || row.semi_auto_winners === null) return false;
  if (row.rank1_winners === 0) return row.win_type0 === 0 && row.round >= 262;
  return row.auto_winners + row.manual_winners + row.semi_auto_winners === row.rank1_winners;
}

export function toApi(row: DrawRow) {
  return {
    round: row.round,
    drawDate: row.draw_date,
    numbers: [row.n1, row.n2, row.n3, row.n4, row.n5, row.n6],
    bonus: row.bonus,
    ranks: [1, 2, 3, 4, 5].map((r) => ({
      rank: r,
      winners: row[`rank${r}_winners` as keyof DrawRow] as number,
      prize: row[`rank${r}_prize` as keyof DrawRow] as number,
      totalPrize: row[`rank${r}_total_prize` as keyof DrawRow] as number | null,
    })),
    totalSales: row.total_sales,
    prizePool: row.prize_pool,
    totalWinners: row.total_winners,
    // 1st-prize winners by pick type. null when the source has no breakdown: old rounds report 0/0/0,
    // so it only counts when the three add up to the 1st-prize winner count.
    firstPrizePickTypes: hasPickBreakdown(row)
      ? { auto: row.auto_winners!, manual: row.manual_winners!, semiAuto: row.semi_auto_winners! }
      : null,
    winType0: row.win_type0,
    gameSeq: row.game_seq,
    excelRank: row.excel_rank,
  };
}

export type TicketRow = {
  round: number; rank: number; seq: number;
  store_id: string | null; store_name: string | null; address: string | null; region: string | null;
  pick_type: string | null; lat: number | null; lng: number | null; phone: string | null; status: string | null;
};

export function ticketToApi(t: TicketRow) {
  return {
    rank: t.rank,
    seq: t.seq,
    storeId: t.store_id,
    storeName: t.store_name,
    address: t.address,
    region: t.region,
    phone: t.phone,
    status: t.status,
    pickType: t.pick_type,
    isInternet: t.store_id === '51100000',
    lat: t.lat,
    lng: t.lng,
  };
}
