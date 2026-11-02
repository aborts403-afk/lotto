// App icon "A · 떨어진 공": five balls crowded together, one yellow ball alone (the numbers others leave).
// Writes every icon asset the app and the store need. Run from this folder: node icons.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(here, '../../../assets/images');
const STORE = resolve(here, '../images');

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F80F5"/><stop offset="1" stop-color="#1449B8"/></linearGradient>
  <radialGradient id="w" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE7F8"/></radialGradient>
  <radialGradient id="y" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#FFE27A"/><stop offset="0.55" stop-color="#FBC400"/><stop offset="1" stop-color="#E9A400"/></radialGradient>
  <filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#06245E" flood-opacity="0.35"/></filter>
</defs>`;
const CROWD = [[300, 640, 118], [470, 700, 104], [250, 820, 96], [420, 860, 88], [560, 870, 72]];
const ALONE = [720, 330, 140];
// Bounding box of the mark, to center and scale it.
const BOX = { x0: 154, y0: 190, x1: 860, y1: 958 };

function mark({ mono = false } = {}) {
  const w = mono ? 'fill="#FFFFFF" fill-opacity="0.6"' : 'fill="url(#w)" filter="url(#s)"';
  const y = mono ? 'fill="#FFFFFF"' : 'fill="url(#y)" filter="url(#s)"';
  return CROWD.map(([x, cy, r]) => `<circle cx="${x}" cy="${cy}" r="${r}" ${w}/>`).join('') + `<circle cx="${ALONE[0]}" cy="${ALONE[1]}" r="${ALONE[2]}" ${y}/>`;
}
// Mark scaled by `s` and centered in the 1024 canvas.
function centered(s, opts) {
  const cx = (BOX.x0 + BOX.x1) / 2, cy = (BOX.y0 + BOX.y1) / 2;
  return `<g transform="translate(512 512) scale(${s}) translate(${-cx} ${-cy})">${mark(opts)}</g>`;
}
const svg = (body, bg = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" style="display:block">${defs}${bg ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}${body}</svg>`;

const jobs = [
  // Full icon (iOS, Expo icon, store): the composed layout as designed.
  [`${ASSETS}/icon.png`, 1024, svg(mark()), false],
  [`${STORE}/icon-512.png`, 512, svg(mark()), false],
  [`${ASSETS}/favicon.png`, 48, svg(mark()), false],
  [`${ASSETS}/logo-96.png`, 96, svg(mark()), false], // in-app header logo
  // Android adaptive icon: launchers mask to a circle/squircle using the inner ~61%; keep the mark inside it.
  [`${ASSETS}/android-icon-foreground.png`, 1024, svg(centered(0.56), false), true],
  [`${ASSETS}/android-icon-background.png`, 1024, svg('', true), false],
  [`${ASSETS}/android-icon-monochrome.png`, 1024, svg(centered(0.56, { mono: true }), false), true],
  // Splash: the mark on the app's blue splash background.
  [`${ASSETS}/splash-icon.png`, 512, svg(centered(0.86), false), true],
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [out, size, body, transparent] of jobs) {
  const page = await (await browser.newContext({ viewport: { width: size, height: size + 200 } })).newPage();
  await page.setContent(`<html style="margin:0;overflow:hidden"><body style="margin:0;background:transparent;overflow:hidden">${body.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('icons written');
