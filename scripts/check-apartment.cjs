'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
const { chromium } = require(toolsPath ? path.join(toolsPath, 'playwright') : 'playwright');
const base = (process.env.HOUSE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => { if (page.url().includes('/apartment.html')) errors.push(error.message); });
    const ready = async floor => {
      await page.waitForFunction(floor => window.apartmentScene?.inspect().state === 'ready' && window.apartmentScene.inspect().floor === floor && !window.apartmentScene.inspect().moving, floor);
    };
    await page.goto(base + '/apartment.html'); await ready('ground');
    console.log('Apartment renderer ready');
    assert.equal(await page.locator('body').innerText(), '', 'The apartment must have no visible text');
    assert.equal(await page.locator('.apartment-door:visible').count(), 4);
    await page.waitForTimeout(250);
    const inspect = await page.evaluate(() => window.apartmentScene.inspect());
    assert.equal(inspect.revision, '186');
    assert.ok(inspect.draws < 70, 'Static ornament must be batched');
    assert.ok(inspect.geometries < 100 && inspect.textures <= 6, 'The GPU asset budget must remain bounded');
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.apartmentScene.inspect().renders), inspect.renders, 'The renderer must sleep while idle');

    // Guided travel is real camera motion, and browser history restores floors.
    await page.getByRole('link', { name: 'Go upstairs', exact: true }).click();
    await page.waitForURL('**/apartment.html#first-floor'); await ready('first');
    console.log('Guided stair ascent complete');
    assert.equal(await page.locator('.apartment-door:visible').count(), 3);
    assert.equal(await page.getByRole('link', { name: 'First floor', exact: true }).getAttribute('aria-current'), 'location');
    await page.goBack(); await ready('ground');
    await page.getByRole('link', { name: 'First floor', exact: true }).click();
    await page.waitForTimeout(80);
    await page.getByRole('link', { name: 'Ground floor', exact: true }).click();
    await ready('ground');
    console.log('PASS guided stairs, floor history, interrupted floor travel, idle rendering, and bounded GPU assets');

    // Looking around moves the camera; releasing a drag must not enter a room.
    await page.mouse.move(720, 770); await page.mouse.down();
    await page.mouse.move(980, 810, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(120);
    assert.ok(Math.abs(await page.evaluate(() => window.apartmentScene.inspect().yaw)) > .1);
    assert.ok(page.url().includes('/apartment.html'));
    await page.getByRole('button', { name: 'Reset the view' }).click();
    await page.waitForFunction(() => !window.apartmentScene.inspect().moving);
    assert.equal(await page.evaluate(() => window.apartmentScene.inspect().yaw), 0);
    await page.keyboard.press('ArrowLeft');
    assert.ok(await page.evaluate(() => window.apartmentScene.inspect().yaw) > 0);
    await page.keyboard.press('Escape');

    // The diagram contains only symbols, and the native modal owns keyboard focus.
    await page.getByRole('button', { name: 'Open the floor plan' }).click();
    assert.equal(await page.getByRole('dialog').innerText(), '');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog')));
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Open the floor plan' }).evaluate(n => n === document.activeElement), true);

    // Test one animated entry and all five actual destination/return routes.
    const journeys = [
      { id: 'studio', floor: 'ground', href: '/drawing.html' },
      { id: 'garden', floor: 'ground', href: '/laby.html' },
      { id: 'salon', floor: 'ground', href: '/urBoard.html' },
      { id: 'music', floor: 'first', href: '/musical-mining/' },
      { id: 'laboratory', floor: 'first', href: '/chemical-rakoon/' },
    ];
    for (const [i, journey] of journeys.entries()) {
      await page.emulateMedia({ reducedMotion: i === 0 ? 'no-preference' : 'reduce' });
      await page.goto(`${base}/apartment.html#${journey.floor}-floor`); await ready(journey.floor);
      if (i === 0) {
        const bounds = await page.locator(`[data-room="${journey.id}"]`).boundingBox();
        // Click the 3D glass below the icon to exercise full-door ray picking.
        await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 72);
      } else await page.locator(`[data-room="${journey.id}"]`).click();
      await page.waitForURL(base + journey.href);
      await page.locator('.house-return').waitFor();
      assert.equal(await page.locator('.house-return').getAttribute('href'), `/apartment.html#${journey.floor}-floor`);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('mottet-apartment-return')), null, 'Arrival markers must be consumed');
      await page.locator('.house-return').click();
      await page.waitForURL(`${base}/apartment.html#${journey.floor}-floor`); await ready(journey.floor);
      console.log(`PASS ${journey.id} entry and return to the ${journey.floor} floor`);
    }
    // Direct visits retain the original house return route.
    await page.goto(base + '/drawing.html');
    assert.equal(await page.locator('.house-return').getAttribute('href'), '/#ground-floor');

    // Check narrow, landscape, tablet, and wide layouts with every icon in bounds.
    for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 740, height: 390 }, { width: 768, height: 1024 }, { width: 1920, height: 720 }]) {
      await page.setViewportSize(viewport);
      for (const floor of ['ground', 'first']) {
        await page.goto(`${base}/apartment.html#${floor}-floor`); await ready(floor);
        const boxes = await page.locator('.apartment-door:visible').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()));
        assert.equal(boxes.length, floor === 'ground' ? 4 : 3);
        for (const box of boxes) {
          assert.ok(box.width >= 44 && box.height >= 44, 'Touch targets must be at least 44 pixels');
          assert.ok(box.left >= 0 && box.right <= viewport.width && box.top >= 0 && box.bottom <= viewport.height, 'Room controls must fit in the viewport');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(await page.locator('body').innerText(), '');
      }
    }
    console.log('PASS text-free desktop, mobile, tablet, landscape, and wide layouts on both floors');

    await page.evaluate(() => { window.apartmentContextLoss = document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.apartmentContextLoss.loseContext(); });
    await page.waitForFunction(() => document.body.dataset.state === 'fallback');
    await page.getByRole('link', { name: 'Ground floor', exact: true }).click();
    await page.evaluate(() => window.apartmentContextLoss.restoreContext());
    await ready('ground');
    assert.equal(await page.locator('.apartment-door:visible').count(), 4);
    console.log('PASS WebGL context recovery after a floor change');

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await touch.goto(base + '/apartment.html');
    await touch.waitForFunction(() => window.apartmentScene?.inspect().state === 'ready');
    const input = await touch.context().newCDPSession(touch);
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 650 }] });
    await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 260, y: 690 }] });
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(Math.abs(await touch.evaluate(() => window.apartmentScene.inspect().yaw)) > .1);
    await touch.getByRole('button', { name: 'Reset the view' }).tap();
    await touch.waitForFunction(() => !window.apartmentScene.inspect().moving);
    await touch.getByRole('link', { name: 'Go upstairs', exact: true }).tap();
    await touch.waitForFunction(() => window.apartmentScene.inspect().floor === 'first' && !window.apartmentScene.inspect().moving);
    await touch.locator('[data-room="music"]').tap(); await touch.waitForURL(base + '/musical-mining/');
    await touch.close();

    // A missing renderer must retain both floors and all destinations without text.
    const fallback = await browser.newPage();
    await fallback.route('**/libraries/three/**', route => route.abort());
    await fallback.goto(base + '/apartment.html');
    await fallback.waitForFunction(() => document.body.dataset.state === 'fallback');
    assert.equal(await fallback.locator('.apartment-door:visible').count(), 4);
    await fallback.getByRole('link', { name: 'Go upstairs', exact: true }).click();
    assert.equal(await fallback.locator('.apartment-door:visible').count(), 3);
    assert.equal(await fallback.locator('body').innerText(), '');
    await fallback.close();
    const noJS = await browser.newPage({ javaScriptEnabled: false });
    await noJS.goto(base + '/apartment.html');
    assert.equal(await noJS.locator('body').innerText(), '');
    assert.equal(await noJS.locator('[data-room="studio"]').getAttribute('href'), '/drawing.html');
    await noJS.close();
    assert.deepEqual(errors, []);
    console.log('PASS touch look/tap entry, reduced motion, renderer failure fallback, no visible text, and no apartment JavaScript errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
