'use strict';

// Draws the watch's pictures from the site's own blue tit and leaves
// (maia/maia-art.js), in the site's night colours, and renders them to PNG
// with headless Chrome into resources/drawables:
//
//   node art/build-art.cjs            (CHROME=/path/to/chrome to choose one)
//
// tit_sleep, tit_awake, tit_rest and tit_happy are 120 px squares whose feet
// touch y = 113 at x = 62 (Art.TIT_FEET_* in Art.mc); branch is 416 x 150 and
// the tit perches at (208, 119) on it; sprig sits under the list's title;
// launcher_icon is the 70 px app icon.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '..', 'resources', 'drawables');
const CHROME = process.env.CHROME || 'google-chrome';

// The site's dark theme (maia/maia.css).
const C = {
  belly: '#e2cb62', wing: '#6a8bc0', cap: '#557bb8', white: '#efe8d6', line: '#1f2733',
  leaf: '#5f7a4c', moss: '#86a673', bark: '#c49c69', bark2: '#8a6d45', blush: '#e39a8c', eye: '#141210',
};

const leaf = (x, y, r, s = 1) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="${C.leaf}" stroke="${C.moss}" stroke-width="${1.1 / s}" d="M0 0C6-10 18-14 30-8C22 2 10 6 0 0Z"/><path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="none" stroke="${C.moss}" stroke-width="${0.9 / s}" opacity=".7" d="M2-1C10-4 18-7 26-8"/>`;

// The eye in each mood, at the site's eye position (8, -10).
const EYES = {
  awake: `<circle cx="8" cy="-10" r="1.9" fill="${C.eye}"/><circle cx="8.7" cy="-10.7" r=".6" fill="#fff"/>`,
  sleep: `<path d="M5.9-10.4Q8-8.2 10.1-10.4" fill="none" stroke="${C.eye}" stroke-width="1.1" stroke-linecap="round"/>`,
  rest: `<circle cx="8" cy="-10" r="1.9" fill="${C.eye}"/><path d="M5.8-10.2A2.2 2.2 0 0 1 10.2-10.2Z" fill="${C.white}"/><path d="M5.8-10.2L10.2-10.2" stroke="${C.eye}" stroke-width=".8" stroke-linecap="round"/>`,
  happy: `<path d="M5.9-9.4Q8-12 10.1-9.4" fill="none" stroke="${C.eye}" stroke-width="1.2" stroke-linecap="round"/>`,
};

// The site's blue tit with a rosy cheek, in tit units (about 46 wide).
const tit = mood => `<g stroke="${C.line}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">
  <path d="M-14 2C-20 6-24 12-22 18C-18 14-14 10-11 6Z" fill="${C.cap}"/>
  <path d="M-14 0C-14-10-6-16 2-16C12-16 17-8 16 2C15 10 8 14 0 14C-8 14-14 8-14 0Z" fill="${C.belly}"/>
  <path d="M-13-2C-8-10 2-12 10-8C6-2-2 2-13-2Z" fill="${C.wing}"/>
  <path d="M-2-16C4-20 12-18 15-12C10-11 4-10 0-11C-3-12-4-14-2-16Z" fill="${C.cap}"/>
  <path d="M-1-12C4-12 10-11 14-9C10-7 4-6-1-8Z" fill="${C.white}"/>
  <path d="M15-11L21-9L15-7Z" fill="${C.line}"/>
  <path d="M0 14L-2 20M3 14L4 20M-2 20L-5 21M-2 20L0 22M4 20L7 21M4 20L4 23" fill="none"/>
</g>
<ellipse cx="10" cy="-5.2" rx="2.4" ry="1.4" fill="${C.blush}" opacity=".8"/>
${EYES[mood]}`;

const TIT_SCALE = 2.4; // 50 tit units -> 120 px; feet (y 23) land at 113 px, x 0 at 62 px
const titSvg = mood => ({ w: 120, h: 120, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="-26 -24 50 50">${tit(mood)}</svg>` });

// A bough across the top of the round screen, sagging to where the tit sits.
const BOUGH = 'M22 88C100 126 168 121 208 119C252 117 316 125 394 84';
const branch = () => ({ w: 416, h: 150, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="416" height="150" viewBox="0 0 416 150">
  <g fill="none" stroke-linecap="round">
    <path d="${BOUGH}" stroke="${C.bark2}" stroke-width="7"/>
    <path d="${BOUGH}" stroke="${C.bark}" stroke-width="3" opacity=".75"/>
    <path d="M118 117C108 100 112 86 124 74" stroke="${C.bark2}" stroke-width="3"/>
    <path d="M300 118C312 102 310 88 298 76" stroke="${C.bark2}" stroke-width="3"/>
  </g>
  ${[[58, 102, 150, .72], [86, 112, 20, .78], [124, 74, -70, .6], [114, 92, 200, .55], [160, 121, 150, .62],
     [256, 118, 20, .62], [298, 76, 250, .6], [306, 94, -20, .55], [332, 118, 165, .78], [362, 102, 25, .7]].map(a => leaf(...a)).join('')}
</svg>` });

// The site's card sprig (art-sprig), twice its size.
const sprig = () => ({ w: 160, h: 32, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="32" viewBox="0 0 120 24">
  <path d="M0 12C30 10 50 14 60 12C70 10 90 14 120 12" fill="none" stroke="${C.bark2}" stroke-width="1.4" stroke-linecap="round"/>
  ${[[44, 12, -30, .45], [60, 13, 30, .45], [76, 12, 200, .45], [28, 12, 210, .35], [92, 12, -20, .35]].map(a => leaf(...a)).join('')}
</svg>` });

// The app's icon (menu and glance): the awake tit alone on transparency,
// cropped to its own outline (tail -24 to beak 21, cap -20 to toes 23) so it
// fills the 70 px square the Venu 2 asks for.
const icon = () => ({ w: 70, h: 70, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="-25.3 -22 48 48">${tit('awake')}</svg>` });

const ART = {
  launcher_icon: icon(),
  tit_sleep: titSvg('sleep'), tit_awake: titSvg('awake'), tit_rest: titSvg('rest'), tit_happy: titSvg('happy'),
  branch: branch(), sprig: sprig(),
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maia-watch-art-'));
for (const [name, { w, h, svg }] of Object.entries(ART)) {
  const page = path.join(tmp, `${name}.html`);
  fs.writeFileSync(page, `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`,
    '--default-background-color=00000000', `--screenshot=${path.join(OUT, `${name}.png`)}`, `file://${page}`], { stdio: 'ignore' });
  console.log(`${name}.png ${w}x${h}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
