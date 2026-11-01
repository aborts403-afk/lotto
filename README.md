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
| `GET /api/health` | 수집 상태 (최신 회차가 8일 넘게 지나면 503) |

## 당첨번호 수집
- 출처: 동행복권 결과 페이지가 쓰는 JSON (`worker/src/dhlottery.ts`). 공식 공개 API가 아니라서 바뀔 수 있습니다.
- 매주 자동: Worker 크론이 토요일 21:00~23:45 KST에 15분마다, 일요일 09:00 KST에 한 번 더 "마지막 회차 + 1"을 조회해 저장합니다.
- 최초 1회 전체 수집:
  ```
  node scripts/backfill-draws.ts > worker/backfill.sql
  npx wrangler d1 execute lotto-db --remote --file worker/backfill.sql
  ```

## 명령
```
npm run web            # 개발 서버 (웹)
npm run deploy:web     # 웹 빌드 + Worker 배포
npx wrangler d1 migrations apply lotto-db --remote   # DB 스키마 적용
npx wrangler dev --test-scheduled                    # 로컬에서 크론 테스트: /__scheduled
npx wrangler types worker/worker-configuration.d.ts  # wrangler.jsonc 변경 후 타입 재생성
```
