-- Store every field the dhlottery draw API returns, plus a table for winning tickets (stores).

-- selectPstLt645InfoNew.do fields not stored in 0001
ALTER TABLE draws ADD COLUMN win_type0          INTEGER;  -- winType0: 0 = auto/manual breakdown available
ALTER TABLE draws ADD COLUMN auto_winners       INTEGER;  -- winType1: 1st-prize winners, auto pick (자동)
ALTER TABLE draws ADD COLUMN manual_winners     INTEGER;  -- winType2: manual pick (수동)
ALTER TABLE draws ADD COLUMN semi_auto_winners  INTEGER;  -- winType3: semi-auto pick (반자동)
ALTER TABLE draws ADD COLUMN game_seq           INTEGER;  -- gmSqNo
ALTER TABLE draws ADD COLUMN rank1_total_prize  INTEGER;  -- rnk1SumWnAmt (KRW, all winners)
ALTER TABLE draws ADD COLUMN rank2_total_prize  INTEGER;
ALTER TABLE draws ADD COLUMN rank3_total_prize  INTEGER;
ALTER TABLE draws ADD COLUMN rank4_total_prize  INTEGER;
ALTER TABLE draws ADD COLUMN rank5_total_prize  INTEGER;
ALTER TABLE draws ADD COLUMN total_winners      INTEGER;  -- sumWnNope
ALTER TABLE draws ADD COLUMN prize_pool         INTEGER;  -- rlvtEpsdSumNtslAmt (KRW)
ALTER TABLE draws ADD COLUMN excel_rank         TEXT;     -- excelRnk

-- selectLtWnShp.do: one row per winning ticket (1st and 2nd prize), available from round 262.
CREATE TABLE winning_tickets (
  round                   INTEGER NOT NULL,  -- draw
  rank                    INTEGER NOT NULL,  -- wnShpRnk
  seq                     INTEGER NOT NULL,  -- rnum (order within round+rank)
  game_code               TEXT,              -- ltPcd
  store_id                TEXT,              -- ltShpId ('51100000' = internet sales site)
  store_name              TEXT,              -- shpNm
  trade_name              TEXT,              -- tradNm
  prev_store_name         TEXT,              -- befConmNm
  status                  TEXT,              -- status
  road_name               TEXT,              -- rdnm
  detail_address          TEXT,              -- daddr
  road_address            TEXT,              -- rdnmAddr
  road_detail_address     TEXT,              -- rdnmDtlAddr
  prev_address            TEXT,              -- befAddr
  address                 TEXT,              -- shpAddr
  prev_road_name          TEXT,              -- befRdnm
  phone                   TEXT,              -- shpTelno
  region                  TEXT,              -- region (시/도)
  pick_type_code          TEXT,              -- atmtPsvYn
  pick_type               TEXT,              -- atmtPsvYnTxt (자동/수동/반자동, often null for 2nd prize)
  operation_status_code   TEXT,              -- slrOperSttsCd
  sells_lotto645          TEXT,              -- l645LtNtslYn (Y/N)
  sells_st5               TEXT,              -- st5LtNtslYn
  sells_st10              TEXT,              -- st10LtNtslYn
  sells_st20              TEXT,              -- st20LtNtslYn
  sells_pension720        TEXT,              -- pt720NtslYn
  lat                     REAL,              -- shpLat
  lng                     REAL,              -- shpLot
  fetched_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (round, rank, seq)
);
CREATE INDEX winning_tickets_store ON winning_tickets (store_id);
CREATE INDEX winning_tickets_region ON winning_tickets (region, rank);
