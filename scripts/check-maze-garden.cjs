'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
const { chromium } = require(toolsPath ? path.join(toolsPath, 'playwright') : 'playwright');
const base = (process.env.HOUSE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

const inspect = () => ({ columns: garden.columns, rows: garden.rows, walls: [...walls], cells: [...cases], visited: visitedGardenCells, frames: frameCount,
  stems: gardenStems.length, blooms: [...gardenBlooms], seed: gardenPassages[0][0] + gardenPassages[0][1] * garden.columns,
  opening: gardenOpeningBlooms.size, roses: [...gardenBlooms].map(i => ({ radius: gardenRoses.get(i).radius, progress: gardenRoses.get(i).progress })) });

function checkConnected({ columns, rows, walls, cells, visited, stems, blooms, seed, opening, roses }) {
  const start = cells.indexOf(1), reached = new Set([start]), queue = [start];
  assert.equal(visited, cells.filter(Boolean).length);
  assert.ok(visited >= walls.length * .85, 'Branches must spread across most of the grid');
  let branches = 0, openings = 0;
  const deadEnds = [];
  for (let i = 0; i < walls.length; i++) {
    if (!cells[i]) assert.equal(walls[i], 15, 'Untouched pockets must retain their walls');
    const degree = [1, 2, 4, 8].filter(bit => !(walls[i] & bit)).length;
    openings += degree;
    if (degree >= 3) branches++;
    if (degree === 1 && i !== seed) deadEnds.push(i);
    const x = i % columns, y = Math.floor(i / columns);
    if (x < columns - 1) assert.equal(Boolean(walls[i] & 2), Boolean(walls[i + 1] & 8));
    else assert.ok(walls[i] & 2);
    if (y < rows - 1) assert.equal(Boolean(walls[i] & 4), Boolean(walls[i + columns] & 1));
    else assert.ok(walls[i] & 4);
    if (!x) assert.ok(walls[i] & 8);
    if (!y) assert.ok(walls[i] & 1);
  }
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at], x = i % columns, y = Math.floor(i / columns);
    for (const [next, open] of [
      [i - columns, y > 0 && !(walls[i] & 1)], [i + 1, x < columns - 1 && !(walls[i] & 2)],
      [i + columns, y < rows - 1 && !(walls[i] & 4)], [i - 1, x > 0 && !(walls[i] & 8)]
    ]) {
      if (open && !reached.has(next)) { reached.add(next); queue.push(next); }
    }
  }
  assert.equal(reached.size, visited, 'All grown branches must connect to the seed');
  assert.equal(openings / 2, visited - 1, 'Walkers must only grow into unvisited cells');
  assert.equal(stems, openings / 2, 'A rose stem must follow every carved passage');
  assert.deepEqual([...blooms].sort((a, b) => a - b), deadEnds, 'Each terminal branch must have exactly one rose');
  assert.equal(opening, 0, 'Completed gardens must finish blooming');
  assert.ok(roses.every(rose => rose.progress === 1));
  assert.ok(new Set(roses.map(rose => rose.radius.toFixed(2))).size > 1, 'Roses must have varied sizes');
  return { branches, pockets: walls.length - visited };
}

async function checkScreen(page) {
  await page.waitForFunction(() => {
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return Math.abs(garden.width - rect.width) < 1 && Math.abs(garden.height - rect.height) < 1;
  });
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height, bottom: rect.bottom, navTop: document.querySelector('.house-room-nav').getBoundingClientRect().top,
      viewportWidth: innerWidth, viewportHeight: innerHeight, ratio: canvas.width / canvas.height, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(geometry.width >= geometry.viewportWidth - 26, 'The garden must fill the screen width');
  assert.ok(geometry.height >= geometry.viewportHeight - 100, 'The garden must fill the available height');
  assert.ok(Math.abs(geometry.width / geometry.height - geometry.ratio) < .003, 'Cells and ornaments must scale uniformly');
  assert.ok(geometry.bottom < geometry.navTop, 'House controls must stay clear of the garden');
  assert.equal(geometry.overflow, false);
  const grid = await page.evaluate(() => ({ width: garden.columns * garden.cell, height: garden.rows * garden.cell,
    canvasWidth: garden.width, canvasHeight: garden.height, x: garden.x, y: garden.y, cell: garden.cell }));
  assert.ok(grid.width >= grid.canvasWidth * .7 && grid.height >= grid.canvasHeight * .7, 'The maze grid must use most of the screen');
  assert.ok(grid.x > 0 && grid.y > 0 && grid.cell >= 14, 'Square cells must remain readable and inside the canvas');
}

(async () => {
  const browser = await chromium.launch({ headless: true }), errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/laby.html');
    await page.locator('canvas').waitFor();
    await checkScreen(page);
    await page.evaluate(() => { noLoop(); gardenAnimating = true; });
    await page.waitForTimeout(100);
    const earlyFrames = await page.evaluate(() => {
      randomSeed(4);
      resetGarden();
      const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
      const density = canvas.width / garden.width;
      let changedPixels = 0, untouchedChanges = 0;
      for (let frame = 0; frame < 24; frame++) {
        const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data, previousWalls = [...walls];
        growGarden();
        paintGarden();
        const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const carved = previousWalls.flatMap((wall, i) => wall !== walls[i] ? [i] : []);
        for (let offset = 0; offset < before.length; offset += 4) {
          if ([0, 1, 2, 3].every(channel => before[offset + channel] === after[offset + channel])) continue;
          changedPixels++;
          const x = (offset / 4 % canvas.width + .5) / density;
          const y = (Math.floor(offset / 4 / canvas.width) + .5) / density;
          const local = carved.some(i => Math.abs(x - (garden.x + (i % garden.columns + .5) * garden.cell)) < 2 * garden.cell
            && Math.abs(y - (garden.y + (Math.floor(i / garden.columns) + .5) * garden.cell)) < 2 * garden.cell);
          if (!local) untouchedChanges++;
        }
      }
      return { changedPixels, untouchedChanges };
    });
    assert.ok(earlyFrames.changedPixels > 0, 'The opening frames must carve the maze');
    assert.equal(earlyFrames.untouchedChanges, 0, 'Untouched wall edges must not shimmer during the opening frames');
    const bloomAnimation = await page.evaluate(() => {
      while (!gardenBlooms.size) growGarden();
      paintGarden();
      const areas = [];
      for (const elapsed of [0, 160, 900]) {
        gardenBloomTime += elapsed;
        updateGardenBlooms();
        paintGarden();
        const rgba = gardenFlowers.getContext('2d').getImageData(0, 0, gardenFlowers.width, gardenFlowers.height).data;
        let area = 0;
        for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 32) area++;
        areas.push(area);
      }
      return { areas, opening: gardenOpeningBlooms.size };
    });
    assert.ok(bloomAnimation.areas[0] > 0 && bloomAnimation.areas[0] < bloomAnimation.areas[1]
      && bloomAnimation.areas[1] < bloomAnimation.areas[2], 'Buds must gradually open into full flowers');
    assert.equal(bloomAnimation.opening, 0, 'Bloom animations must settle');
    await page.evaluate(() => { randomSeed(4); gardenAnimating = false; resetGarden(); window.mazeTestStarted = performance.now(); });
    const pathColours = new Map();
    for (let sample = 0; sample < 10; sample++) {
      await page.waitForTimeout(100);
      const pixels = await page.evaluate(() => {
        const canvas = document.querySelector('canvas'), density = canvas.width / garden.width;
        const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return cases.flatMap((visited, i) => {
          if (!visited) return [];
          const x = Math.floor((garden.x + (i % garden.columns + .5) * garden.cell) * density);
          const y = Math.floor((garden.y + (Math.floor(i / garden.columns) + .5) * garden.cell) * density);
          const offset = (x + y * canvas.width) * 4;
          const animated = [...gardenOpeningBlooms].some(bloom => {
            const rose = gardenRoses.get(bloom), reach = rose.size * .65;
            return Math.abs((i % garden.columns - bloom % garden.columns) * garden.cell) <= reach
              && Math.abs((Math.floor(i / garden.columns) - Math.floor(bloom / garden.columns)) * garden.cell) <= reach;
          });
          return [[i, walls[i] + (gardenBlooms.has(i) ? 16 : 0), animated, [...rgba.slice(offset, offset + 4)]]];
        });
      });
      for (const [cell, state, animated, colour] of pixels) {
        assert.equal(colour[3], 255, 'Paths must never flash transparent');
        const previous = pathColours.get(cell);
        if (previous && previous.state === state && !animated && !previous.animated) assert.deepEqual(colour, previous.colour, 'Pixels outside opening flowers must stay stable');
        pathColours.set(cell, { state, animated, colour });
      }
    }
    assert.equal(await page.locator('canvas').getAttribute('data-garden-state'), 'growing');
    await page.waitForSelector('canvas[data-garden-state="complete"]');
    const elapsed = await page.evaluate(() => performance.now() - window.mazeTestStarted);
    assert.ok(elapsed >= 2200 && elapsed < 4500, 'Growth must quickly complete in about 2.4 seconds');
    const complete = await page.evaluate(inspect);
    const growth = checkConnected(complete);
    assert.ok(growth.branches > 0, 'The original simultaneous walkers must create branches');
    assert.ok(growth.pockets > 0, 'Growth must leave untouched pockets instead of filling the grid');
    const rendering = await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
      const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      gardenDirty = true; gardenDamage = null; paintGarden();
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let largestDifference = 0, invalidEdges = 0, missingRoses = 0;
      const stems = gardenPlants.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const flowers = gardenFlowers.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < before.length; i++) largestDifference = Math.max(largestDifference, Math.abs(before[i] - after[i]));
      const density = canvas.width / garden.width;
      for (const i of gardenBlooms) {
        const x = Math.floor((garden.x + (i % garden.columns + .5) * garden.cell) * density);
        const y = Math.floor((garden.y + (Math.floor(i / garden.columns) + .5) * garden.cell) * density);
        const offset = (x + y * canvas.width) * 4;
        if (after[offset] <= after[offset + 1] + 15) missingRoses++;
      }
      const wallAt = (x, y) => {
        const offset = (Math.floor(y * density) * canvas.width + Math.floor(x * density)) * 4;
        // Large roses and curved stems intentionally overlap some grid edges.
        if (stems[offset + 3] || flowers[offset + 3]) return null;
        return after[offset] < 200;
      };
      for (let y = 0; y < garden.rows; y++) for (let x = 0; x < garden.columns; x++) {
        const wall = walls[x + y * garden.columns];
        const north = wallAt(garden.x + (x + .2) * garden.cell, garden.y + y * garden.cell);
        const west = wallAt(garden.x + x * garden.cell, garden.y + (y + .2) * garden.cell);
        if (north !== null && north !== Boolean(wall & 1)) invalidEdges++;
        if (west !== null && west !== Boolean(wall & 8)) invalidEdges++;
      }
      return { largestDifference, invalidEdges, missingRoses };
    });
    assert.ok(rendering.largestDifference <= 1, 'Incremental growth must match a clean redraw without leftover wall fragments');
    assert.equal(rendering.invalidEdges, 0, 'Every drawn grid edge must match the maze walls');
    assert.equal(rendering.missingRoses, 0, 'Every dead end must visibly show a pink rose');
    await page.waitForTimeout(150);
    assert.equal((await page.evaluate(inspect)).frames, complete.frames, 'Idle gardens must stop drawing');
    await page.locator('canvas').click();
    assert.equal(await page.locator('canvas').getAttribute('data-garden-state'), 'growing');
    await page.locator('.house-room-map').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('canvas').count(), 1);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
    const touch = await mobile.newPage();
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(base + '/laby.html');
    await touch.waitForSelector('canvas[data-garden-state="complete"]');
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 844 }, { width: 740, height: 390 }, { width: 768, height: 1024 }]) {
      await touch.setViewportSize(viewport);
      await checkScreen(touch);
      await touch.waitForSelector('canvas[data-garden-state="complete"]');
      checkConnected(await touch.evaluate(inspect));
      for (const seed of [4, 19, 42]) {
        await touch.evaluate(seed => { randomSeed(seed); resetGarden(); }, seed);
        const growth = checkConnected(await touch.evaluate(inspect));
        assert.ok(growth.branches > 0, 'Branching must survive viewport changes');
        assert.ok(growth.pockets > 0, 'Untouched pockets must survive viewport changes');
      }
    }
    const previous = (await touch.evaluate(inspect)).walls.join(',');
    await touch.locator('canvas').tap();
    assert.notEqual((await touch.evaluate(inspect)).walls.join(','), previous);
    await touch.locator('canvas').focus();
    await touch.keyboard.press('Enter');
    await touch.waitForSelector('canvas[data-garden-state="complete"]');
    checkConnected(await touch.evaluate(inspect));
    assert.equal(await touch.locator('canvas').count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS animated buds opening into varied rose sizes, stems on every passage and flowers at every dead end, stable pixels outside blooming flowers, clear grid and clean redraw, fast growth, idle rendering, full-screen layout, four viewport shapes, touch/keyboard regeneration, reduced motion, and no JavaScript errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
