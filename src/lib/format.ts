// Korean money and date formatting.

// 1933658450 -> "19억 3,366만원"; 50000 -> "5만원"; 5000 -> "5,000원"
export function formatKRW(won: number): string {
  if (won < 10_000) return `${won.toLocaleString('ko-KR')}원`;
  const totalMan = Math.round(won / 10_000);
  const eok = Math.floor(totalMan / 10_000);
  const man = totalMan % 10_000;
  if (eok === 0) return `${man.toLocaleString('ko-KR')}만원`;
  return man === 0 ? `${eok.toLocaleString('ko-KR')}억원` : `${eok.toLocaleString('ko-KR')}억 ${man.toLocaleString('ko-KR')}만원`;
}

// "2026-10-31" -> "2026년 10월 31일"
export function formatDateKo(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

// "2026-10-31" -> "2026.10.31"
export function formatDateDots(ymd: string): string {
  return ymd.replaceAll('-', '.');
}

export function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

// Short form for tight spaces (summary tiles): 1,988,320,000 -> "19.9억원"; under 1억 same as formatKRW.
export function formatKRWShort(won: number): string {
  if (won < 100_000_000) return formatKRW(won);
  const eok = Math.floor(won / 10_000_000) / 10; // one decimal, rounded down so it never overstates
  return `${eok.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원`;
}
