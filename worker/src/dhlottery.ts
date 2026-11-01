// Client for the JSON endpoints behind dhlottery.co.kr pages. Unofficial: the pages' own XHRs.
//
// Draws (https://www.dhlottery.co.kr/lt645/result):
//   selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=N returns up to 10 rounds around N
//   (roughly N-5..N+4), and an empty list when N has not been drawn yet.
// Winning tickets / stores (https://www.dhlottery.co.kr/wnprchsplcsrch/home):
//   selectLtWnShp.do?srchWnShpRnk=R&srchLtEpsd=N&srchShpLctn= returns every 1st (R=1) or 2nd (R=2)
//   prize ticket of round N with its store. Available from round 262.

const BASE = 'https://www.dhlottery.co.kr';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (lotto-note collector)', Accept: 'application/json' };

export const FIRST_ROUND_WITH_STORES = 262;
export const INTERNET_STORE_ID = '51100000';

export type Draw = {
  round: number;
  drawDate: string; // YYYY-MM-DD
  numbers: [number, number, number, number, number, number];
  bonus: number;
  ranks: { winners: number; prize: number; totalPrize: number | null }[]; // index 0 = 1st prize
  totalSales: number; // wholEpsdSumNtslAmt
  prizePool: number | null; // rlvtEpsdSumNtslAmt (~50% of sales in recent rounds)
  totalWinners: number | null; // sumWnNope
  winType0: number | null;
  autoWinners: number | null; // winType1 (자동)
  manualWinners: number | null; // winType2 (수동)
  semiAutoWinners: number | null; // winType3 (반자동)
  gameSeq: number | null; // gmSqNo
  excelRank: string | null; // excelRnk
};

export type WinningTicket = {
  round: number;
  rank: number;
  seq: number;
  gameCode: string | null;
  storeId: string | null;
  storeName: string | null;
  tradeName: string | null;
  prevStoreName: string | null;
  status: string | null;
  roadName: string | null;
  detailAddress: string | null;
  roadAddress: string | null;
  roadDetailAddress: string | null;
  prevAddress: string | null;
  address: string | null;
  prevRoadName: string | null;
  phone: string | null;
  region: string | null;
  pickTypeCode: string | null;
  pickType: string | null;
  operationStatusCode: string | null;
  sellsLotto645: string | null;
  sellsSt5: string | null;
  sellsSt10: string | null;
  sellsSt20: string | null;
  sellsPension720: string | null;
  lat: number | null;
  lng: number | null;
};

type Raw = Record<string, unknown>;

async function getList(path: string, what: string): Promise<Raw[]> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, redirect: 'manual' });
  if (res.status !== 200) throw new Error(`dhlottery HTTP ${res.status} for ${what}`);
  const body = (await res.json()) as { data?: { list?: Raw[] | null } | null };
  if (!body.data || !('list' in body.data)) throw new Error(`dhlottery: unexpected response shape for ${what}`);
  return body.data.list ?? [];
}

function num(raw: Raw, key: string): number {
  const v = Number(raw[key]);
  if (raw[key] === null || raw[key] === undefined || !Number.isFinite(v)) {
    throw new Error(`dhlottery: field ${key} missing or not a number`);
  }
  return v;
}

function numOrNull(raw: Raw, key: string): number | null {
  if (raw[key] === null || raw[key] === undefined || raw[key] === '') return null;
  const v = Number(raw[key]);
  return Number.isFinite(v) ? v : null;
}

function strOrNull(raw: Raw, key: string): string | null {
  const v = raw[key];
  return v === null || v === undefined ? null : String(v);
}

export async function fetchAround(round: number): Promise<Draw[]> {
  const list = await getList(`/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${round}`, `round ${round}`);
  return list.map(parseDraw);
}

// Fields seen in API responses that are not mapped above ("draw.foo" / "ticket.bar").
// The collector logs these and the backfill fails on them, so new API fields are not silently dropped.
export const unknownKeysSeen = new Set<string>();
function noteUnknownKeys(raw: Raw, known: Set<string>, prefix: string): void {
  for (const k of Object.keys(raw)) if (!known.has(k)) unknownKeysSeen.add(`${prefix}.${k}`);
}

export function parseDraw(raw: Raw): Draw {
  noteUnknownKeys(raw, KNOWN_DRAW_KEYS, 'draw');
  const ymd = String(raw.ltRflYmd);
  if (!/^\d{8}$/.test(ymd)) throw new Error(`dhlottery: bad date ${ymd}`);
  const numbers = [1, 2, 3, 4, 5, 6].map((i) => num(raw, `tm${i}WnNo`)).sort((a, b) => a - b);
  const bonus = num(raw, 'bnsWnNo');
  for (const n of [...numbers, bonus]) {
    if (!Number.isInteger(n) || n < 1 || n > 45) throw new Error(`dhlottery: number out of range ${n}`);
  }
  return {
    round: num(raw, 'ltEpsd'),
    drawDate: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    numbers: numbers as Draw['numbers'],
    bonus,
    ranks: [1, 2, 3, 4, 5].map((r) => ({
      winners: num(raw, `rnk${r}WnNope`),
      prize: num(raw, `rnk${r}WnAmt`),
      totalPrize: numOrNull(raw, `rnk${r}SumWnAmt`),
    })),
    // wholEpsdSumNtslAmt = ticket sales. (rlvtEpsdSumNtslAmt is the prize pool, ~50% of sales in recent rounds.)
    totalSales: num(raw, 'wholEpsdSumNtslAmt'),
    prizePool: numOrNull(raw, 'rlvtEpsdSumNtslAmt'),
    totalWinners: numOrNull(raw, 'sumWnNope'),
    winType0: numOrNull(raw, 'winType0'),
    autoWinners: numOrNull(raw, 'winType1'),
    manualWinners: numOrNull(raw, 'winType2'),
    semiAutoWinners: numOrNull(raw, 'winType3'),
    gameSeq: numOrNull(raw, 'gmSqNo'),
    excelRank: strOrNull(raw, 'excelRnk'),
  };
}

export async function fetchWinningTickets(round: number, rank: 1 | 2): Promise<WinningTicket[]> {
  const list = await getList(
    `/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=${rank}&srchLtEpsd=${round}&srchShpLctn=`,
    `stores round ${round} rank ${rank}`,
  );
  return list.map((raw, i) => parseWinningTicket(raw, round, rank, i + 1));
}

export function parseWinningTicket(raw: Raw, round: number, rank: number, fallbackSeq: number): WinningTicket {
  noteUnknownKeys(raw, KNOWN_TICKET_KEYS, 'ticket');
  const draw = numOrNull(raw, 'draw');
  if (draw !== null && draw !== round) throw new Error(`dhlottery: store row for round ${draw}, expected ${round}`);
  return {
    round,
    rank,
    seq: numOrNull(raw, 'rnum') ?? fallbackSeq,
    gameCode: strOrNull(raw, 'ltPcd'),
    storeId: strOrNull(raw, 'ltShpId'),
    storeName: strOrNull(raw, 'shpNm'),
    tradeName: strOrNull(raw, 'tradNm'),
    prevStoreName: strOrNull(raw, 'befConmNm'),
    status: strOrNull(raw, 'status'),
    roadName: strOrNull(raw, 'rdnm'),
    detailAddress: strOrNull(raw, 'daddr'),
    roadAddress: strOrNull(raw, 'rdnmAddr'),
    roadDetailAddress: strOrNull(raw, 'rdnmDtlAddr'),
    prevAddress: strOrNull(raw, 'befAddr'),
    address: strOrNull(raw, 'shpAddr'),
    prevRoadName: strOrNull(raw, 'befRdnm'),
    phone: strOrNull(raw, 'shpTelno'),
    region: strOrNull(raw, 'region'),
    pickTypeCode: strOrNull(raw, 'atmtPsvYn'),
    pickType: strOrNull(raw, 'atmtPsvYnTxt'),
    operationStatusCode: strOrNull(raw, 'slrOperSttsCd'),
    sellsLotto645: strOrNull(raw, 'l645LtNtslYn'),
    sellsSt5: strOrNull(raw, 'st5LtNtslYn'),
    sellsSt10: strOrNull(raw, 'st10LtNtslYn'),
    sellsSt20: strOrNull(raw, 'st20LtNtslYn'),
    sellsPension720: strOrNull(raw, 'pt720NtslYn'),
    lat: numOrNull(raw, 'shpLat'),
    lng: numOrNull(raw, 'shpLot'),
  };
}

// Keys of the raw API objects this client maps. Used by the backfill to flag any new, unmapped field.
export const KNOWN_DRAW_KEYS = new Set([
  'winType0', 'winType1', 'winType2', 'winType3', 'gmSqNo', 'ltEpsd',
  'tm1WnNo', 'tm2WnNo', 'tm3WnNo', 'tm4WnNo', 'tm5WnNo', 'tm6WnNo', 'bnsWnNo', 'ltRflYmd',
  ...[1, 2, 3, 4, 5].flatMap((r) => [`rnk${r}WnNope`, `rnk${r}WnAmt`, `rnk${r}SumWnAmt`]),
  'sumWnNope', 'rlvtEpsdSumNtslAmt', 'wholEpsdSumNtslAmt', 'excelRnk',
]);
export const KNOWN_TICKET_KEYS = new Set([
  'rnum', 'ltPcd', 'draw', 'shpNm', 'tradNm', 'befConmNm', 'status', 'rdnm', 'daddr', 'rdnmAddr',
  'rdnmDtlAddr', 'befAddr', 'shpAddr', 'befRdnm', 'shpTelno', 'region', 'atmtPsvYn', 'atmtPsvYnTxt',
  'ltShpId', 'slrOperSttsCd', 'l645LtNtslYn', 'st5LtNtslYn', 'st10LtNtslYn', 'st20LtNtslYn',
  'pt720NtslYn', 'wnShpRnk', 'shpLat', 'shpLot',
]);
