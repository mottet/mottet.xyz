'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
const { chromium } = require(toolsPath ? path.join(toolsPath, 'playwright') : 'playwright');
const base = (process.env.HOUSE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Reduced-precision animation clocks must not leave a completed flight
    // waiting forever just below its fractional duration.
    await page.addInitScript(() => {
      const clock = Object.getOwnPropertyDescriptor(Animation.prototype, 'currentTime');
      Object.defineProperty(Animation.prototype, 'currentTime', {
        configurable: true,
        get() {
          const value = clock.get.call(this);
          return typeof value === 'number' ? Math.floor(value) : value;
        },
        set: clock.set
      });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/board.html');
    await page.locator('#board svg[role="img"]').waitFor();
    // The board reports the camera as the world rectangle in view.
    const viewBox = () => page.evaluate(() => document.getElementById('board').dataset.view.split(' ').map(Number));
    const pawnAt = () => page.evaluate(() => getComputedStyle(document.getElementById('board-pawn')).transform);

    // The camera starts on the hall, showing far less than the whole board.
    const home = await viewBox();
    assert.ok(home[2] < 2000 && Math.abs(home[0] + home[2] / 2 - 2000) < 1, 'The view starts zoomed on the centre');
    assert.equal(await page.locator('.world-sign').count(), 6);
    assert.equal(await page.locator('.world-way').count(), 6);
    assert.equal(await page.locator('.world-station').count(), 6);
    assert.equal(await page.locator('.world-enter').count(), 6);
    assert.ok(await page.locator('#board-world > svg *').count() < 1100, 'The artwork stays within a modest SVG element budget');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect.getTiming().iterations === Infinity).length), 0, 'The resting board has no continuous animations');

    await page.locator('.board.has-cache').waitFor();
    assert.ok(await page.evaluate(() => {
      const canvas = document.querySelector('.world-cache');
      return canvas.width <= 4000 && canvas.getContext('2d').getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3] === 255;
    }), 'The movement cache contains the board and has a bounded allocation');
    const paintSession = await page.context().newCDPSession(page);
    await paintSession.send('LayerTree.enable');
    let largePaints = 0;
    paintSession.on('LayerTree.layerPainted', event => {
      if (event.clip.width * event.clip.height > 1e6) largePaints++;
    });

    // A signpost sends the pawn along its way; the camera follows and the hash records the station.
    const gardenY = await page.locator('[data-station="garden"]').evaluate(node => node.transform.baseVal.getItem(0).matrix.f);
    const start = await pawnAt();
    await page.evaluate(() => {
      window.boardMotion = [];
      window.recordBoardMotion = true;
      const record = time => {
        const v = document.getElementById('board').dataset.view.split(' ').map(Number);
        window.boardMotion.push({ time, x: v[0] + v[2] / 2, y: v[1] + v[3] / 2 });
        if (window.recordBoardMotion) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.locator('[data-sign="garden"] text').click();
    await page.waitForTimeout(1200);
    const midway = await viewBox();
    assert.notEqual(await pawnAt(), start, 'The pawn must leave the hall');
    assert.ok(midway[1] + midway[3] / 2 < 1900, 'The camera follows the pawn up the way');
    await page.locator('.world-station.is-here[data-station="garden"]').waitFor({ timeout: 8000 });
    assert.equal(page.url(), base + '/board.html#garden');
    const arrived = await viewBox();
    assert.ok(Math.abs(arrived[1] + arrived[3] / 2 - gardenY) < 2, 'The camera settles on the station');
    assert.ok(arrived[3] < home[3] * .8, 'Arriving zooms in on the station');
    const peakCameraSpeed = await page.evaluate(() => {
      window.recordBoardMotion = false;
      return window.boardMotion.slice(1).reduce((peak, point, i) => {
        const previous = window.boardMotion[i], dt = (point.time - previous.time) / 1000;
        return dt > 0 ? Math.max(peak, Math.hypot(point.x - previous.x, point.y - previous.y) / dt) : peak;
      }, 0);
    });
    assert.ok(peakCameraSpeed < 6000, 'Departure and arrival have no abrupt camera jumps');
    assert.ok(largePaints < 20, `The journey reuses cached artwork rather than repainting every frame (${largePaints} large paints)`);
    await paintSession.detach();

    // The plate enters the room, which returns to this station of the board.
    await page.getByRole('link', { name: 'Enter the Maze garden' }).click();
    await page.waitForURL(base + '/laby.html');
    await page.locator('.house-room-nav').waitFor();
    assert.equal(await page.locator('.house-return').getAttribute('href'), '/board.html#garden');
    assert.match(await page.locator('.house-return').innerText(), /Board/);
    await page.locator('.house-return').click();
    await page.waitForURL(base + '/board.html#garden');
    await page.locator('.world-station.is-here[data-station="garden"]').waitFor();
    const restored = await viewBox();
    assert.ok(Math.abs(restored[1] + restored[3] / 2 - gardenY) < 2, 'A reload lands straight at the station');

    // The header's hall button walks back, and from there a stair leads to an upstairs station.
    await page.locator('#board-hall').click();
    await page.waitForURL(base + '/board.html#hall');
    await page.waitForFunction(() => !document.querySelector('.world-station.is-here'));
    await page.waitForTimeout(800);
    const backHome = await viewBox();
    assert.ok(Math.abs(backHome[0] + backHome[2] / 2 - 2000) < 1 && Math.abs(backHome[3] - home[3]) < 1, 'Back at the hall, at the home zoom');
    // The way itself is a link; its bounding-box centre is not on the curve, so click it directly.
    await page.getByRole('link', { name: /Follow the stairs to the Musical Mining/ }).dispatchEvent('click');
    await page.locator('.world-station.is-here[data-station="music"]').waitFor({ timeout: 10000 });

    // Dragging pans; the whole-board button shows everything.
    const before = await viewBox();
    // This station sits near the board's edge, so drag towards the centre.
    await page.mouse.move(700, 450);
    await page.mouse.down();
    await page.mouse.move(900, 600, { steps: 8 });
    await page.mouse.up();
    const dragged = await viewBox();
    assert.ok(dragged[0] < before[0] && dragged[1] < before[1], 'Dragging moves the camera');
    await page.getByRole('button', { name: 'Whole board' }).click();
    await page.waitForTimeout(1100);
    const whole = await viewBox();
    assert.ok(whole[2] >= 4000 || whole[3] >= 4000, 'The whole board fits the view');
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.keyboard.press('Escape');

    // The heading returns home; room titles, buttons, and dragging still work.
    await page.locator('.board-brand-name').click();
    await page.waitForURL(base + '/board.html');
    await page.locator('.board.has-cache').waitFor();
    await page.locator('[data-sign="studio"] text').click();
    await page.locator('.world-station.is-here[data-station="studio"]').waitFor({ timeout: 8000 });
    assert.equal(await page.locator('.board.is-moving').count(), 0, 'A title-triggered flight releases the interaction lock');
    // The sixth station lies below the hall, past the moved cartouche.
    await page.locator('.board-brand-name').click();
    await page.waitForURL(base + '/board.html');
    await page.waitForFunction(() => !document.querySelector('.board.is-moving'));
    await page.locator('[data-sign="glyphs"] text').click();
    await page.locator('.world-station.is-here[data-station="glyphs"]').waitFor({ timeout: 8000 });
    assert.equal(page.url(), base + '/board.html#glyphs');
    assert.equal(await page.getByRole('link', { name: 'Enter the Glyphs' }).getAttribute('href'), '/glyphs.html');
    await page.getByRole('button', { name: 'Whole board' }).click();
    await page.waitForFunction(() => !document.querySelector('.board.is-moving'));
    assert.equal(await page.locator('#board-overview').getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Whole board' }).click();
    await page.waitForFunction(() => !document.querySelector('.board.is-moving'));
    const afterTitle = await viewBox();
    await page.mouse.move(700, 450);
    await page.mouse.down();
    await page.mouse.move(800, 500, { steps: 8 });
    await page.mouse.up();
    assert.notDeepEqual(await viewBox(), afterTitle, 'Dragging works after clicking the heading and a room title');

    // A direct visit to a room still returns to the house.
    await page.goto(base + '/laby.html');
    await page.locator('.house-room-nav').waitFor();
    assert.equal(await page.locator('.house-return').getAttribute('href'), '/#ground-floor');

    // Reduced motion arrives at once, and phones get the same world.
    const calm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const phone = await calm.newPage();
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(base + '/board.html');
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await phone.getByRole('link', { name: /Set off for the Games room/ }).click();
    await phone.locator('.world-station.is-here[data-station="salon"]').waitFor({ timeout: 3000 });
    await phone.getByRole('link', { name: 'Enter the Games room' }).click();
    await phone.waitForURL(base + '/urBoard.html');
    await calm.close();

    assert.deepEqual(errors, []);
    console.log('PASS zoomed start, six ways and stations, smooth camera with rounded clocks, title navigation without input locks, board return route, stair journey, dragging, overview, floor plan, direct-visit house return, reduced motion, phone, and no JavaScript errors');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
