# 스토어 스크린샷 다시 만들기

1. 웹 빌드를 로컬에서 띄워요: `npx expo export -p web && npx wrangler dev --port 8800` (저장소 루트)
2. 이 폴더에서:
   ```
   npm i --no-save playwright-core@1.48.2
   mkdir -p raw
   node qrimg.mjs     # 1248회 용지 QR 이미지(qr.mjpeg) — QR 스캔 화면용 가짜 카메라 영상
   node capture.mjs   # 실제 화면 8장 → raw/
   node compose.mjs   # 문구 + 폰 틀 → ../images/ (1080×1920 JPG, 그래픽 이미지 1024×500)
   ```
- 로컬 Chrome을 써요(`channel: 'chrome'`). 내 번호 화면은 `seed-1248.js`로 예시 번호를 넣어요.
- 문구는 `compose.mjs`의 `SHOTS`에서 바꿔요.
- 아이콘(앱·Android 적응형·단색·스플래시·파비콘·헤더 로고·스토어 512px): `node icons.mjs`. 디자인은 "떨어진 공"(흰 공 5개가 몰려 있고 노란 공 하나만 떨어져 있음)이에요.
