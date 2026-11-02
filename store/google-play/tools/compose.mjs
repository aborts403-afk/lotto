import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const SHOTS = [
  ['1-home', '틈새번호', '확률은 같아요.\n나눌 사람 수는 달라요.', '1등이 되면 덜 나누는 번호와 예상 실수령액'],
  ['2-diagnose', '번호 진단', '내 번호로 1등이면\n몇 명과 나눌까?', '인기도 진단, 세후 수령액 비교, 덜 겹치는 대안까지'],
  ['3-generate', '상금 지키는 번호', '남들이 안 고르는\n조합만 골라요', '세트마다 1등 세후 예상액을 함께 보여 드려요'],
  ['4-qr', 'QR 당첨 확인', '용지 QR 한 번에\n모든 게임 결과', '등수와 당첨금을 확인하고 바로 저장해요'],
  ['5-my', '내 번호', '저장해 두면\n추첨 뒤 자동 확인', '회차별 결과와 누적 당첨금을 한눈에'],
  ['6-simulator', '시뮬레이션', '이 번호로\n20년 샀다면?', '실제 역대 당첨 결과로 계산해요'],
  ['7-stores', '1등 판매점', '1등이 많이 나온\n판매점은 어디?', '지역별 순위와 당첨 회차, 네이버 지도로 바로'],
  ['8-stats', '번호 통계', '통계도 정직하게,\n이론값과 나란히', '많이 나온 번호, 합계·끝수·연속 번호 분포'],
];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
for (const [i, [file, label, title, sub]] of SHOTS.entries()) {
  const dark = i % 2 === 0;
  const bg = dark ? '#1B64DA' : '#EEF3FB';
  const fg = dark ? '#FFFFFF' : '#191F28';
  const soft = dark ? 'rgba(255,255,255,0.86)' : '#4E5968';
  const pillBg = dark ? 'rgba(255,255,255,0.18)' : '#DCE8FB';
  const pillFg = dark ? '#FFFFFF' : '#1B64DA';
  const img = readFileSync(`raw/${file}.png`).toString('base64');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  html,body{margin:0;width:1080px;height:1920px;background:${bg};font-family:Pretendard,sans-serif;overflow:hidden}
  .wrap{position:relative;width:1080px;height:1920px;display:flex;flex-direction:column;align-items:center}
  .head{padding:118px 90px 0;align-self:stretch;display:flex;flex-direction:column;gap:26px}
  .pill{align-self:flex-start;background:${pillBg};color:${pillFg};font-size:34px;font-weight:700;padding:10px 26px;border-radius:999px}
  h1{margin:0;color:${fg};font-size:84px;line-height:108px;font-weight:800;letter-spacing:-2.5px;white-space:pre-line}
  p{margin:0;color:${soft};font-size:38px;line-height:54px;font-weight:500;letter-spacing:-0.5px}
  .phone{position:absolute;left:50%;transform:translateX(-50%);top:600px;width:640px;border-radius:80px;padding:16px;background:#0B1F44;box-shadow:0 30px 80px rgba(9,30,66,${dark ? 0.45 : 0.22})}
  .phone img{display:block;width:640px;border-radius:64px}
</style></head><body><div class="wrap">
  <div class="head"><div class="pill">${label}</div><h1>${title}</h1><p>${sub}</p></div>
  <div class="phone"><img src="data:image/png;base64,${img}"></div>
</div></body></html>`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `../images/screenshot-${i + 1}-${file.split('-').slice(1).join('-')}.jpg`, type: 'jpeg', quality: 92 });
}

// Feature graphic 1024x500 (required), and the 512x512 icon.
const fg = await (await browser.newContext({ viewport: { width: 1024, height: 500 } })).newPage();
const balls = [[15, '#69C8F2'], [21, '#FF7272'], [26, '#FF7272'], [29, '#FF7272'], [35, '#AAAAAA'], [42, '#B0D840']];
await fg.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>html,body{margin:0;width:1024px;height:500px;background:#1B64DA;font-family:Pretendard,sans-serif;overflow:hidden}
.w{display:flex;height:500px;align-items:center;padding:0 72px;gap:56px;box-sizing:border-box}
h1{margin:0;color:#fff;font-size:76px;font-weight:800;letter-spacing:-2px}
p{margin:10px 0 26px;color:rgba(255,255,255,0.88);font-size:32px;font-weight:600;letter-spacing:-0.5px}
.balls{display:flex;gap:12px}.balls b{width:62px;height:62px;border-radius:31px;color:#fff;font-size:26px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(255,255,255,0.9)}
</style></head><body><div class="w">
<img src="data:image/png;base64,${readFileSync(new URL('../../../assets/images/icon.png', import.meta.url)).toString('base64')}" style="width:236px;height:236px;border-radius:54px;box-shadow:0 18px 40px rgba(6,36,94,0.35)">
<div><h1>틈새번호</h1><p>확률은 같아요. 나눌 사람 수는 달라요.</p>
<div class="balls">${balls.map(([n, c]) => `<b style="background:${c}">${n}</b>`).join('')}</div></div>
</div></body></html>`);
await fg.waitForLoadState('networkidle');
await fg.evaluate(() => document.fonts.ready);
await fg.screenshot({ path: '../images/feature-graphic-1024x500.jpg', type: 'jpeg', quality: 95 });
await browser.close();
console.log('composed');
