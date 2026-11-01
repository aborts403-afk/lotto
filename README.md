# 로또 노트

로또 당첨번호 조회, 번호 생성, 내 번호 당첨 확인 앱 (Expo: 웹 + 안드로이드).

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
| `GET /api/health` | 수집 상태 (최신 회차가 8일 넘게 지나면 503) |

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
- `npm run check:generator`: 생성기 점검

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
