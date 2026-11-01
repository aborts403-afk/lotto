-- One row per Lotto 6/45 draw. Source: dhlottery.co.kr result page JSON.
CREATE TABLE draws (
  round           INTEGER PRIMARY KEY,
  draw_date       TEXT    NOT NULL,       -- YYYY-MM-DD (KST)
  n1 INTEGER NOT NULL, n2 INTEGER NOT NULL, n3 INTEGER NOT NULL,
  n4 INTEGER NOT NULL, n5 INTEGER NOT NULL, n6 INTEGER NOT NULL,
  bonus           INTEGER NOT NULL,
  rank1_winners   INTEGER NOT NULL, rank1_prize INTEGER NOT NULL,   -- prize = per winner, KRW
  rank2_winners   INTEGER NOT NULL, rank2_prize INTEGER NOT NULL,
  rank3_winners   INTEGER NOT NULL, rank3_prize INTEGER NOT NULL,
  rank4_winners   INTEGER NOT NULL, rank4_prize INTEGER NOT NULL,
  rank5_winners   INTEGER NOT NULL, rank5_prize INTEGER NOT NULL,
  total_sales     INTEGER NOT NULL,       -- KRW sold for this round
  fetched_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Key/value status for the collector (last success, last error) used by /api/health.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
