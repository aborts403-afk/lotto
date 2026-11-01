import type { Draw } from './dhlottery';

export type DrawRow = {
  round: number;
  draw_date: string;
  n1: number; n2: number; n3: number; n4: number; n5: number; n6: number;
  bonus: number;
  rank1_winners: number; rank1_prize: number;
  rank2_winners: number; rank2_prize: number;
  rank3_winners: number; rank3_prize: number;
  rank4_winners: number; rank4_prize: number;
  rank5_winners: number; rank5_prize: number;
  total_sales: number;
};

export function insertDrawStmt(db: D1Database, d: Draw): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO draws (round, draw_date, n1, n2, n3, n4, n5, n6, bonus,
        rank1_winners, rank1_prize, rank2_winners, rank2_prize, rank3_winners, rank3_prize,
        rank4_winners, rank4_prize, rank5_winners, rank5_prize, total_sales)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      d.round, d.drawDate, ...d.numbers, d.bonus,
      ...d.ranks.flatMap((r) => [r.winners, r.prize]),
      d.totalSales,
    );
}

export async function latestRound(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT MAX(round) AS r FROM draws').first<{ r: number | null }>();
  return row?.r ?? 0;
}

export async function setMeta(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value)
    .run();
}

export async function getMeta(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM meta').all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
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
    })),
    totalSales: row.total_sales,
  };
}
