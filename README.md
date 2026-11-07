# 틈새번호

1등 상금을 덜 나누는 로또 번호 앱: 남들이 안 고르는 번호 생성, 당첨 확인, 통계·판매점 (Expo: 웹 + 안드로이드).

- 앱 이름은 틈새번호지만, 내부 식별자(Worker 이름 `lotto-note`, Expo slug `lotto`)는 그대로입니다. Worker 이름을 바꾸면 새 Worker로 배포돼 도메인과 크론이 옛 Worker에 남습니다.

- 웹: https://lotto.q-ova.com
- 앱 코드: `src/` (Expo Router)
- 서버: `worker/` (Cloudflare Worker + D1). 정적 웹 빌드를 서빙하고 `/api/*`를 처리합니다.

## API
| 경로 | 설명 |
|---|---|
| `GET /api/latest` | 최신 회차 |
| `GET /api/draws?limit=N` | 회차 목록 (최신순, limit 생략 시 전체) |
| `GET /api/draws/:round` | 특정 회차 |
| `GET /api/draws/:round/stores` | 1·2등 당첨 판매점 |
| `GET /api/stores/summary` | 판매점 순위 (전체 30곳, 지역별 15곳)와 지역별 1등 수. 광주·전남은 합쳐서 셉니다. 크론이 판매점을 갱신할 때 미리 계산해 `meta`에 저장해 둔 값 |
| `GET /api/stores/tickets/:block` | 빌드용: `block*100`~`block*100+99`회의 1·2등 당첨 판매점 전체 |
| `GET /api/health` | 수집 상태 (최신 회차가 8일 넘게 지나면 503) |

### 캐시와 무료 플랜 한도
- `/api/*` 응답은 Cloudflare 엣지 캐시(Cache API)에 담깁니다: 최신 회차·회차 목록 5분, 회차 1시간, 확정된 회차의 판매점 1일, 최근 4회차 판매점 10분, 판매점 요약 1시간. `/api/health`는 캐시하지 않습니다.
- 캐시 키는 경로와 정규화한 `limit`만 씁니다 (`limit`은 10/60/520/전체로 올림). 쿼리 문자열을 바꿔 캐시를 우회할 수 없습니다.
- 그래서 D1 읽기는 사용자 수가 아니라 캐시 만료 횟수에 비례합니다. 남는 한도는 Workers 무료 플랜의 하루 10만 요청(`/api/*`만 해당, 정적 파일은 제외)입니다.

## 당첨번호 수집
- 출처: 동행복권 결과 페이지가 쓰는 JSON (`worker/src/dhlottery.ts`). 공식 공개 API가 아니라서 바뀔 수 있습니다.
- 매주 자동: Worker 크론이 "마지막 회차 + 1"을 조회해 저장합니다. 토요일 20:45~21:25 KST 5분마다, 21:30~23:45 KST 15분마다, 일요일 09:00 KST 한 번.
- 최초 1회 전체 수집:
  ```
  npx tsx scripts/backfill-draws.mts > worker/backfill.sql
  npx wrangler d1 execute lotto-db --remote --file worker/backfill.sql
  ```

## 저장하는 데이터 (D1)
- `draws`: 당첨번호 API의 모든 필드. 1등 자동/수동/반자동 인원(`auto_winners` 등)은 262회부터 있습니다.
- `winning_tickets`: 1·2등 당첨 1건마다 판매점 API의 모든 필드 (판매점, 주소, 지역, 위경도, 자동/수동, 인터넷 구매는 `store_id = '51100000'`). 262회부터 있습니다.
- 처음 한 번 판매점 전체 수집:
  ```
  DELAY_MS=2000 npx tsx scripts/backfill-stores.mts > worker/backfill-stores.sql
  npx wrangler d1 execute lotto-db --remote --file worker/backfill-stores.sql
  ```
  응답은 `worker/.cache/stores`에 캐시돼서, 중간에 끊겨도 이어서 받습니다. 너무 빨리 요청하면 동행복권이 IP를 일시적으로 막아요.
- 매주 크론이 최근 4개 회차의 판매점 데이터를 당첨자 수와 맞을 때까지 다시 확인합니다.
- API에 아직 저장하지 않는 새 필드가 생기면 `meta.unknown_fields`에 기록됩니다.

## 번호 생성기 (남들이 안 고르는 번호)
- 당첨 확률은 모든 조합이 같고, 다른 사람과 겹칠 가능성(1등 상금을 나눌 사람 수)만 다릅니다.
- `analysis/popularity.py`: 역대 3등 당첨자 수로 번호별 인기도를 추정해 `src/lib/lotto/popularity-weights.ts`를 생성합니다. 홀수 회차로 검증(학습에 안 쓴 회차)한 결과도 출력합니다.
  ```
  python3 -m venv .venv && .venv/bin/pip install -r analysis/requirements.txt
  .venv/bin/python analysis/popularity.py
  ```
- `src/lib/lotto/generator.ts`: 사람들이 일부러 고르는 모양(연속 3개, 등차 5개, 용지 한 줄 4개, 모두 31 이하, 같은 끝자리 3개)을 빼고, 인기도 하위 10% 후보 중에서 무작위로 뽑습니다.
- 모드: 남들이 안 고르는 번호, 완전 무작위, 당첨번호 닮은꼴(`isBalanced`), 많이 나온 번호 위주(최근 100회 출현 횟수² 가중치), 오래 안 나온 번호 위주(미출현 회차 수 가중치), 역대 패턴으로 뽑기(`pattern.ts`), 내 후보로 조합(`pool`), 문구로 뽑기(문구+회차로 시드를 만들어 같은 문구는 그 회차 동안 같은 번호).
- `generate()` 옵션: 모드, 세트 수, 고정수(최대 5개), 제외수, 홀수 개수, 합계 범위. 조건이 불가능하면 `error`를 돌려주고, 고정수 때문에 흔한 모양을 피할 수 없으면 `patternsRelaxed`로 알려 줍니다.
- `src/lib/lotto/pattern.ts` (역대 패턴으로 뽑기): 최근 N회 출현 빈도·미출현 기간을 조합한 규칙 3,000개를 만들어 51~900회에서 다음 회차 적중 개수가 가장 높았던 규칙(세트당 0.882개, 무작위 0.800개)을 그대로 넣었습니다. 규칙을 고를 때 쓰지 않은 최근 348회의 적중 개수(`patternBacktest`, 약 0.73개)를 화면에 같이 보여 줍니다. 과거 적합은 운이었고 예측력은 없다는 것을 보여 주기 위한 모드입니다.
- 세트끼리 번호 안 겹치게(기본, 세부 조건에서 끌 수 있음): 여러 세트를 살 때 "이번 주에 하나라도 5등 이상" 확률을 올립니다. 1등 확률과 평균 당첨 장수는 같습니다. 815만 가지 추첨 결과를 모두 대입한 정확한 값: 3세트 6.98%→7.14%, 5세트 11.36%→11.87%, 10세트 21.43%→22.1~22.9%(배치에 따라 다름). 화면의 확률은 겹치지 않으면 다항식으로 정확히(`disjointPrizeChance`), 10세트처럼 겹치면 시드 고정 20만 회 시뮬레이션(`simulatedPrizeChance`, ±0.1%p)으로 계산합니다.
- 드문 모양 빼기(기본, 세부 조건에서 끌 수 있음, `rareShape`): 모두 홀수·짝수, 모두 1~22·23~45, 합계 80 미만·200 초과, 4연속, 연속 쌍 3개, 한 번호대에 5개, 같은 끝자리 4개, 용지 가로·세로 한 줄에 4개, 직전 회차 번호 4개 이상. 전체 조합의 10.9%(전수 계산)이고 역대 1,248회 중 158회가 이런 모양이었습니다(무작위 기대와 같음). 한 장의 당첨 확률은 바뀌지 않습니다. 조건 때문에 피할 수 없으면 `rareRelaxed`로 알려 줍니다.
- 역대 1등 조합은 모든 모드에서 빼고 뽑습니다(`pastWinningKeys`). 확률 때문이 아니라 이미 나온 번호를 주지 않기 위해서입니다.
- `npm run check:generator`: 생성기 점검 (`check:stats`에 패턴 모드 점검 포함)

## 화면 구성
- 탭: 홈 · 번호(`/generate`) · 진단(`/diagnose`) · 내 번호(`/my`) · 기록.
- 하위 페이지는 페이지 제목 아래 밑줄 탭(`src/components/tab-strip.tsx`)으로 나눕니다.
  - 내 번호: 저장한 번호 / 당첨 확인 (한 화면 안의 탭, `/my?round=…`로 들어오면 당첨 확인)
  - 기록: 번호 통계(`/stats`) / 시뮬레이션(`/stats/simulator`) / 회차 결과(`/round`) / 1등 판매점(`/stats/stores`)
- 기록 탭의 페이지는 `src/app/(records)/` 그룹에 있습니다. 그룹이라 주소는 그대로이고, 네이티브 탭에서 숨긴 탭은 이동할 수 없어서 한 탭(한 스택) 안에 묶었습니다. 탭을 누르면 `anchor: "stats"`(번호 통계)로 열립니다.

## 번호 진단과 1등 예상 수령액 (`/diagnose`, `src/lib/lotto/payout.ts`)
- 인기도 배율: 번호별 인기도(`popularity-weights.ts`)로 구한 `exp(점수)`를 무작위 조합 평균이 1이 되게 맞추고, 0.6만큼 1 쪽으로 줄입니다. 분석에 안 쓴 회차 검증에서 1등 기준 효과(0.95~1.08배)가 원래 모델(0.90~1.10배)보다 작았기 때문입니다.
- 예상 수령액: 최근 1등이 나온 52회 각각에 대해, 같은 조합을 산 다른 사람 수를 포아송(평균 = 판매 매수 ÷ 8,145,060 × 배율)으로 보고 내 몫의 기대값 `1등 총액 × (1 − e^−λ) / λ`에 세금(3억까지 22%, 초과분 33%)을 뺀 값을 평균합니다.
- 진단: 인기도 백분위, 흔한 모양(연속, 한 줄, 생일 번호 등), 인기 많은/적은 번호. 덜 겹치는 대안은 사용자가 고른 번호 중 덜 고르는 번호 2개까지 남기고 뽑습니다.
- `npm run check:payout`으로 점검합니다.

## 시뮬레이터 (`/stats/simulator`, `src/lib/lotto/simulate.ts`)
- 같은 번호를 기간 안의 모든 회차에 1장씩 산 것으로 보고, 회차별 실제 1인당 당첨금(세전)으로 정산합니다. 87회까지는 2,000원, 이후 1,000원입니다.

## 당첨 확인과 내 번호 (`/my`)
- 회차와 번호 6개를 넣으면 등수와 당첨금을 보여 줍니다 (`src/lib/lotto/check.ts`). `/my?round=1248&numbers=1,2,3,4,5,6`로 미리 채울 수 있습니다.
- 저장한 번호는 기기에만 남습니다 (AsyncStorage, 웹은 localStorage). 번호 생성 화면에서도 저장할 수 있고, 추첨이 끝나면 회차별로 결과를 보여 줍니다.
- 앱 번들에 없는 최신 회차는 `/api/draws?limit=N`로 한 번 받아 옵니다 (`src/hooks/use-latest-draw.ts`). 설치한 앱이 오래돼도 당첨 확인이 됩니다.

## 통계와 판매점
- `/stats`: 번호별 출현, 홀짝·고저, 합계 분포, 끝수, 연속 번호, 이월수, 많이 나온 번호 쌍. 이론값은 정확히 계산합니다. `npm run check:stats`로 점검합니다.
- `/stats/:n`: 번호별 상세 (출현 간격, 같이 나온 번호, 사람들이 고르는 정도).
- 회차별 판매점: 확정된 회차(최근 4회차 제외)는 빌드할 때 `public/data/stores/<회차>.json` 정적 파일로 만들어 Worker와 D1을 거치지 않고 내려받습니다 (git에는 올리지 않음). 최근 회차와 파일이 없는 경우는 `/api/draws/:round/stores`를 씁니다. 크론이 다시 확인하는 회차 수(`STORE_SYNC_RECENT_ROUNDS`)와 앱(`STATIC_STORES_THROUGH`), 빌드 스크립트의 값을 맞춰야 합니다.
- `/stats/stores`: 빌드할 때 `/api/stores/summary`를 `src/data/stores.json`으로 받습니다. API를 못 받으면 커밋된 파일을 그대로 씁니다. 회차 상세의 판매점 목록은 화면에서 `/api/draws/:round/stores`를 불러옵니다.
- 로컬에서 Worker로 빌드 데이터 받기: `API_BASE=http://localhost:8787 npx tsx scripts/sync-draws.mts`

## 회차별 페이지와 자동 배포
- `/round`, `/round/:round`: 빌드할 때 `scripts/sync-draws.mts`가 `/api/draws`를 받아 `src/data/draws.json`, `public/sitemap.xml`, `public/robots.txt`를 만들고, 회차마다 정적 HTML을 생성합니다 (검색 노출용).
- `.github/workflows/deploy.yml`: main 푸시, 매주 토요일 추첨 후(21:40, 23:55 KST)와 일요일 09:30 KST에 다시 빌드하고 배포합니다. 그래서 새 회차 페이지가 자동으로 생깁니다.
  - 필요한 GitHub 시크릿: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## 명령
```
npm run web            # 개발 서버 (웹)
npm run deploy:web     # 웹 빌드 + Worker 배포
npx wrangler d1 migrations apply lotto-db --remote   # DB 스키마 적용
npx wrangler dev --test-scheduled                    # 로컬에서 크론 테스트: /__scheduled
npx wrangler types worker/worker-configuration.d.ts  # wrangler.jsonc 변경 후 타입 재생성
```
