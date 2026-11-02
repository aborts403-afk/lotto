import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const B = 'http://localhost:8800';
const OUT = 'raw';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + process.cwd() + '/qr.mjpeg'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 720 }, deviceScaleFactor: 3, permissions: ['camera'], colorScheme: 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
// Saved tickets: 1248 results and 1249 waiting.
await page.goto(B + '/my', { waitUntil: 'networkidle' });
await page.evaluate(readFileSync('seed-1248.js', 'utf8'));
await page.evaluate(() => {
  const t = JSON.parse(localStorage.getItem('my-tickets-v1'));
  const now = new Date().toISOString();
  [[13, 22, 24, 26, 36, 45], [5, 19, 28, 34, 40, 43], [17, 23, 32, 36, 41, 44]].forEach((numbers, i) => t.unshift({ id: 'w' + i, round: 1249, numbers, source: 'generate', createdAt: now }));
  localStorage.setItem('my-tickets-v1', JSON.stringify(t));
});
const shot = async (name, path, prep) => {
  await page.goto(B + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (prep) await prep();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
// Scroll the page's main scroll view so `text` sits near the top.
const scrollTo = (text, offset = 16) => page.evaluate(({ text, offset }) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.childElementCount === 0 && d.textContent === text && d.getBoundingClientRect().height > 0);
  if (!el) return false;
  let p = el.parentElement;
  while (p && !(p.scrollHeight > p.clientHeight + 10 && getComputedStyle(p).overflowY !== 'visible')) p = p.parentElement;
  if (!p) return false;
  p.scrollTop += el.getBoundingClientRect().top - offset;
  return true;
}, { text, offset });

await shot('1-home', '/');
await shot('2-diagnose', '/diagnose?numbers=3,7,12,17,21,28', () => scrollTo('진단 결과', 34));
await shot('3-generate', '/generate', () => scrollTo('1세트', 92));
await shot('4-qr', '/my?round=1248', async () => {
  await page.getByRole('button', { name: '복권 용지 QR 스캔' }).click();
  await page.waitForSelector('text=1248회 용지', { timeout: 15000 });
  await page.waitForTimeout(600);
  await scrollTo('복권 용지 QR 스캔', 14);
});
await shot('5-my', '/my');
await shot('6-simulator', '/stats/simulator?numbers=3,7,12,17,21,28', () => scrollTo('쓴 돈', 260));
await shot('7-stores', '/stats/stores');
await shot('8-stats', '/stats');
console.log('errors', errors);
await browser.close();
