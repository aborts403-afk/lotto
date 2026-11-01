// Tiny helpers to emit SQL literals for D1 backfill files.
export function sqlValue(v: string | number | null): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

export function insertSql(verb: 'INSERT' | 'INSERT OR REPLACE', table: string, columns: readonly string[], values: (string | number | null)[]): string {
  return `${verb} INTO ${table} (${columns.join(', ')}) VALUES (${values.map(sqlValue).join(', ')});`;
}
