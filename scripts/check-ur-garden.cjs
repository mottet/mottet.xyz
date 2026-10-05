'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.UR_BUILD_TOOLS ? path.join(process.env.UR_BUILD_TOOLS, 'playwright') : 'playwright');
const url = process.env.UR_BASE_URL || 'https://mottet.xyz/urBoard.html';

(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
   window.idleCanvasClears = 0;
   const clearRect = CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (this.canvas.id === 'ur-board' || this.canvas.id === 'ur-pieces') window.idleCanvasClears++;
    return clearRect.apply(this, args);
   };
  });
  const errors = [], bitmapRequests = [], woodRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/assets\/ur\/garden-/.test(request.url())) bitmapRequests.push(request.url()); });
  page.on('request', request => { if (/\/assets\/ur\/walnut-/.test(request.url())) woodRequests.push(request.url()); });
  await page.goto(url);
  await page.waitForFunction(() => performance.getEntriesByName('ur-ready').length > 0);
  await page.evaluate(() => { window.idleCanvasClears = 0; });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.idleCanvasClears), 0, 'The game must not redraw its canvases while idle');
  const details = await page.locator('#garden-background').evaluate(garden => ({
   tag: garden.tagName, paths: garden.querySelectorAll('path').length,
   layers: garden.querySelectorAll('[data-room-layer]').length, leaves: Number(garden.dataset.leaves),
   textures: garden.querySelectorAll('pattern').length,
   lamps: garden.querySelectorAll('use[href="#room-sconce"]').length,
   images: garden.querySelectorAll('image').length, depth: Number(garden.dataset.depth),
   pointerEvents: getComputedStyle(garden).pointerEvents, transform: getComputedStyle(garden).transform
  }));
  assert.equal(details.tag, 'svg');
  assert.equal(details.layers, 3);
  assert.ok(details.paths >= 9 && details.paths <= 30, 'Material grain stays batched into a small set of vector paths');
  assert.equal(details.depth, 0);
  assert.equal(details.leaves, 0);
  assert.ok(details.textures >= 2 && details.textures <= 6, 'The room reuses a bounded set of material textures');
  assert.equal(details.lamps, 0);
  assert.equal(details.images, 1, 'Only the fine wood grain is pre-rendered');
  assert.equal(woodRequests.length, 1, 'The room and table share one preloaded grain tile');
  assert.equal(await page.locator('#walnut-texture').evaluate(texture => texture.complete && texture.naturalWidth === 512), true);
  assert.equal(details.pointerEvents, 'none');
  assert.equal(details.transform, 'none');
  assert.deepEqual(bitmapRequests, []);
  assert.equal(await page.locator('.table-ornament').evaluate(ornament => getComputedStyle(ornament).pointerEvents), 'none');

  // Height changes must reuse existing geometry rather than repeat the calculation.
  await page.evaluate(() => { window.originalGardenPath = document.querySelector('#garden-background path'); });
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.waitForFunction(() => document.querySelector('#garden-background').viewBox.baseVal.height === 700);
  assert.equal(await page.evaluate(() => originalGardenPath === document.querySelector('#garden-background path')), true);
  assert.equal(await page.locator('#room-panel-field').getAttribute('y'), '532');

  // A burst of resizes must leave a correctly sized, sharp final viewport.
  for (const width of [768, 320, 390]) await page.setViewportSize({ width, height: 844 });
  await page.waitForFunction(() => document.querySelector('#garden-background').viewBox.baseVal.width === 390);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.locator('#garden-background').evaluate(garden => garden.getBoundingClientRect().height), 844);
  assert.equal(await page.evaluate(() => originalGardenPath === document.querySelector('#garden-background path')), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('#garden-background').evaluate(garden => getComputedStyle(garden).animationName), 'none');
  assert.deepEqual(errors, []);
  console.log('PASS idle canvases, vector room, shared grain tile, bounded geometry, retina rendering, geometry reuse, rapid resizing, reduced motion, and no foliage bitmap requests');
 } finally {
  await browser.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
