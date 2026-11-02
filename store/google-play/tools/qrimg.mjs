import { chromium } from 'playwright-core';
// A 1248회 ticket: game A = 2nd prize (5 + bonus 22), game B = 4th, game C = no prize.
const url = 'https://m.dhlottery.co.kr/qr.do?method=winQr&v=1248q161822273638q051618273644m0211192733410000001234';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 640, height: 480 } })).newPage();
await page.setContent(`<html><body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;height:480px"><div id="q"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>new QRCode(document.getElementById('q'), { text: ${JSON.stringify(url)}, width: 300, height: 300, correctLevel: QRCode.CorrectLevel.M });</script></body></html>`);
await page.waitForTimeout(800);
await page.screenshot({ path: 'qr.mjpeg', type: 'jpeg', quality: 95 });
await page.screenshot({ path: 'qr.png' });
await browser.close();
console.log('qr image ready');
