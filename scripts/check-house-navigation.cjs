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
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/');

    // Walking upstairs and browser Back must agree about the current floor.
    assert.equal(await page.getByRole('link', { name: /Drawing studio/ }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: /Musical Mining/ }).isVisible(), false);
    await page.getByRole('link', { name: /Take the stairs/ }).click();
    await page.waitForURL('**/#first-floor');
    assert.equal(await page.getByRole('link', { name: /Musical Mining/ }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: /Drawing studio/ }).isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.closest('[hidden]') === null), true);
    await page.goBack();
    await page.getByRole('link', { name: /Drawing studio/ }).waitFor({ state: 'visible' });

    // Modal keyboard navigation stays inside the plan and restores its opener.
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Floor plan', exact: true }).evaluate(n => n === document.activeElement), true);
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
    await page.getByRole('link', { name: /Landing/ }).click();
    await page.waitForURL('**/#first-floor');
    assert.equal(await page.getByRole('dialog').count(), 0);

    // Every original page can be entered through its door and exited to its floor.
    const journeys = [
      { floor: 'ground', door: /Drawing studio/, url: '/drawing.html', room: 'Drawing studio' },
      { floor: 'ground', door: /Games room/, url: '/urBoard.html', room: 'Games room' },
      { floor: 'ground', door: /Maze garden/, url: '/laby.html', room: 'Maze garden' },
      { floor: 'first', door: /Musical Mining/, url: '/musical-mining/', room: 'Music room' },
      { floor: 'first', door: /Chemical Rakoon/, url: '/chemical-rakoon/', room: 'Laboratory' }
    ];
    for (const journey of journeys) {
      await page.goto(base + '/#' + journey.floor + '-floor');
      await page.getByRole('link', { name: journey.door }).click();
      await page.waitForURL(base + journey.url);
      await page.locator('.house-room-nav').waitFor();
      assert.equal(await page.locator('.house-return').getAttribute('href'), '/#' + journey.floor + '-floor');
      if (['Drawing studio', 'Maze garden'].includes(journey.room)) {
        await page.locator('canvas').waitFor();
        await page.evaluate(() => {
          window.houseTestCanvasPresses = 0;
          const pressed = window.mousePressed;
          window.mousePressed = (...args) => { window.houseTestCanvasPresses++; return pressed(...args); };
        });
      }
      await page.locator('.house-room-nav button').click();
      const current = page.locator('dialog a[aria-current="page"]');
      assert.equal(await current.getAttribute('href'), journey.url);
      assert.match(await current.innerText(), /You are here/i);
      if (['Drawing studio', 'Maze garden'].includes(journey.room)) {
        assert.equal(await page.evaluate(() => window.houseTestCanvasPresses), 0, 'Opening the floor plan must not draw or restart the maze');
      }
      await page.keyboard.press('Escape');
      await page.locator('.house-return').click();
      await page.waitForURL(base + '/#' + journey.floor + '-floor');
    }

    // All doors remain usable on small screens and with reduced motion.
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + '/');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole('button', { name: 'Floor plan', exact: true }).click();
      assert.equal(await page.evaluate(() => {
        const rect = document.querySelector('dialog').getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
      }), true, 'The plan must fit inside the mobile viewport');
      await page.keyboard.press('Escape');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('link', { name: /Drawing studio/ }).focus();
    assert.equal(await page.locator('[data-door-art="studio"] .house-leaf').evaluate(n => getComputedStyle(n).transform), 'none');
    await page.getByRole('link', { name: /Drawing studio/ }).press('Enter');
    await page.waitForURL(base + '/drawing.html');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ['/drawing.html', '/laby.html']) {
      await page.goto(base + url);
      await page.locator('canvas').waitFor();
      const dimensions = await page.locator('canvas').evaluate(canvas => {
        const rect = canvas.getBoundingClientRect();
        return { visibleRatio: rect.width / rect.height, actualRatio: canvas.width / canvas.height, bottom: rect.bottom, navTop: document.querySelector('.house-room-nav').getBoundingClientRect().top };
      });
      assert.ok(Math.abs(dimensions.visibleRatio - dimensions.actualRatio) < .003, 'Room frames must preserve the canvas proportions');
      assert.ok(dimensions.bottom < dimensions.navTop, 'The house controls must not cover the canvas');
    }
    assert.deepEqual(errors, []);
    console.log('PASS five door-to-page journeys, floor history, return routes, current-room map, keyboard focus, isolated canvas input, mobile layout, reduced motion, and no JavaScript errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
