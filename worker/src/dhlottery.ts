// Client for the JSON endpoint behind https://www.dhlottery.co.kr/lt645/result.
// Unofficial: the page's own XHR. `srchDir=center&srchLtEpsd=N` returns up to 10 rounds around N
// (roughly N-5..N+4), and an empty list when N has not been drawn yet.

const ENDPOINT = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';

export type Draw = {
  round: number;
  drawDate: string; // YYYY-MM-DD
  numbers: [number, number, number, number, number, number];
  bonus: number;
  ranks: { winners: number; prize: number }[]; // index 0 = 1st prize
  totalSales: number;
};

type RawDraw = Record<string, number | string>;

export async function fetchAround(round: number): Promise<Draw[]> {
  const url = `${ENDPOINT}?srchDir=center&srchLtEpsd=${round}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (lotto-note collector)', Accept: 'application/json' },
    redirect: 'manual',
  });
  if (res.status !== 200) throw new Error(`dhlottery HTTP ${res.status} for round ${round}`);
  const body = (await res.json()) as { data?: { list?: RawDraw[] } };
  const list = body.data?.list;
  if (!Array.isArray(list)) throw new Error(`dhlottery: unexpected response shape for round ${round}`);
  return list.map(parseDraw);
}

function num(raw: RawDraw, key: string): number {
  const v = Number(raw[key]);
  if (!Number.isFinite(v)) throw new Error(`dhlottery: field ${key} missing or not a number`);
  return v;
}

export function parseDraw(raw: RawDraw): Draw {
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
    ranks: [1, 2, 3, 4, 5].map((r) => ({ winners: num(raw, `rnk${r}WnNope`), prize: num(raw, `rnk${r}WnAmt`) })),
    totalSales: num(raw, 'rlvtEpsdSumNtslAmt'),
  };
}
