'use strict';

// Glyphs checks. `--unit` runs the rules, recogniser and a balance simulation
// in Node alone; without it the browser check follows, against a running
// server (HOUSE_BASE_URL, default http://127.0.0.1:8080) with Playwright
// resolved from HOUSE_TEST_TOOLS.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const S = require('../public/glyphs-spells.js');
const R = require('../public/glyphs-recognizer.js');

function unit() {
  // Every reaction is the mirror of its reverse.
  const all = S.OPTIONS.concat('fizzle');
  for (const a of all) for (const b of all) {
    const ab = S.reactions(a, b), ba = S.reactions(b, a);
    assert.equal(ab.name, ba.name, `${a}/${b} name`);
    assert.deepEqual(ab.marks.a, ba.marks.b, `${a}/${b} marks`);
    assert.deepEqual(ab.marks.b, ba.marks.a, `${a}/${b} marks`);
  }
  // The four-cycle and the diagonals.
  assert.deepEqual(S.reactions('flame', 'stone').marks, { a: {}, b: { fire: 1 } });
  assert.deepEqual(S.reactions('stone', 'wave').marks, { a: {}, b: { earth: 1 } });
  assert.deepEqual(S.reactions('wave', 'wind').marks, { a: {}, b: { water: 1 } });
  assert.deepEqual(S.reactions('wind', 'flame').marks, { a: {}, b: { fire: 1 } });
  assert.equal(S.reactions('flame', 'wave').name, 'steam');
  assert.deepEqual(S.reactions('stone', 'wind').marks, { a: { air: 1 }, b: { earth: 1 } });
  let r;
  // Ward holds the heavy elements and settles its caster; the light ones go
  // over it. Mirror turns the light ones and fails the heavy ones.
  // The ring turns the heavy elements back and is leapt by the light ones;
  // the mirror turns the light ones and fails against the heavy ones.
  assert.deepEqual(S.reactions('ward', 'wave').marks, { a: {}, b: { water: 1 } });
  assert.deepEqual(S.reactions('ward', 'stone').marks, { a: {}, b: { earth: 1 } });
  assert.deepEqual(S.reactions('ward', 'flame').marks, { a: { fire: 1 }, b: {} });
  assert.deepEqual(S.reactions('ward', 'wind').marks, { a: { air: 1 }, b: {} });
  assert.deepEqual(S.reactions('mirror', 'flame').marks, { a: {}, b: { fire: 1 } });
  assert.deepEqual(S.reactions('mirror', 'stone').marks, { a: { earth: 1 }, b: {} });
  // Rest heals the heaviest element first, then the blow lands; fizzle does not heal.
  r = S.applyRound({ fire: 2, water: 0, earth: 1, air: 0 }, S.emptyBody(), 'rest', 'wave');
  assert.deepEqual(r.heals, ['fire', null]);
  assert.deepEqual(r.bodies[0], { fire: 0, water: 0, earth: 1, air: 0 }, 'one ember fades, the wave then meets the other ember as steam');
  assert.deepEqual(r.cancellations[0], [{ name: 'steam', count: 1 }]);
  r = S.applyRound({ fire: 2, water: 0, earth: 0, air: 0 }, S.emptyBody(), 'fizzle', 'flame');
  assert.deepEqual(r.bodies[0], { fire: 3, water: 0, earth: 0, air: 0 });
  assert.deepEqual(r.deaths, ['fire', null]);
  // Opposite marks cancel, so a burning caster is saved by water.
  r = S.applyRound({ fire: 2, water: 0, earth: 0, air: 0 }, S.emptyBody(), 'rest', 'wave');
  assert.equal(r.bodies[0].fire, 0);
  // Momentum: a second Flame lands two marks, a third three; a reflected
  // third Flame burns its own caster for three; rest breaks the run.
  let streak = null;
  streak = S.nextStreak(streak, 'flame'); assert.deepEqual(streak, { id: 'flame', n: 1 });
  streak = S.nextStreak(streak, 'flame'); assert.equal(S.powerOf(streak), 2);
  streak = S.nextStreak(streak, 'flame'); assert.equal(S.powerOf(streak), 3);
  streak = S.nextStreak(streak, 'flame'); assert.equal(S.powerOf(streak), S.MAX_POWER);
  assert.deepEqual(S.nextStreak(streak, 'rest'), { id: null, n: 0 });
  assert.deepEqual(S.nextStreak(streak, 'ward'), { id: null, n: 0 });
  assert.deepEqual(S.reactions('flame', 'rest', 2, 1).marks, { a: {}, b: { fire: 2 } });
  assert.deepEqual(S.reactions('flame', 'mirror', 3, 1).marks, { a: { fire: 3 }, b: {} });
  assert.deepEqual(S.reactions('flame', 'flame', 2, 1).marks, { a: { fire: 1 }, b: { fire: 2 } });
  assert.deepEqual(S.reactions('stone', 'wind', 2, 3).marks, { a: { air: 3 }, b: { earth: 2 } });
  r = S.applyRound(S.emptyBody(), S.emptyBody(), 'wave', 'rest', [3, 1]);
  assert.deepEqual(r.deaths, [null, 'water'], 'a third wave drowns a resting caster outright');
  // Compounds react as their parts and land both elements unanswered.
  assert.deepEqual(S.reactions('bolt', 'rest').marks, { a: {}, b: { fire: 1, air: 1 } });
  assert.deepEqual(S.reactions('bolt', 'mirror').marks, { a: { fire: 1, air: 1 }, b: {} }, 'both parts reflected');
  assert.deepEqual(S.reactions('vine', 'ward').marks, { a: { earth: 1, water: 1 }, b: {} }, 'both parts break back');
  assert.deepEqual(S.reactions('magma', 'wave').marks, { a: {}, b: { earth: 1 } }, 'steam for the fire, mud for the stone');
  assert.deepEqual(S.reactions('bolt', 'rest', 2, 1).marks, { a: {}, b: { fire: 2, air: 2 } }, 'momentum scales both parts');
  assert.equal(S.reactions('bolt', 'stone').name, 'lava and pass');
  // Both can fall at once.
  r = S.applyRound({ earth: 2, fire: 0, water: 0, air: 0 }, { earth: 2, fire: 0, water: 0, air: 0 }, 'stone', 'stone');
  assert.deepEqual(r.deaths, ['earth', 'earth']);
  console.log('PASS rules: symmetric matrix, four-cycle, diagonals, guards, rest and fizzle, compounds, momentum, cancellation, deaths');

  // The recogniser against a synthetic hand: rotation, squeeze, shear and a
  // slow wobble along the stroke, at mild to strong levels.
  const templates = S.spells.flatMap(s => s.variants.map(v => ({ id: s.id, strokes: v })));
  const prepared = R.prepare(templates);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;
  const hand = (strokes, level) => {
    const rot = gauss() * .06 * level, sx = 1 + gauss() * .12 * level, sy = 1 + gauss() * .12 * level, shear = gauss() * .08 * level;
    const ph = [rnd() * 6.28, rnd() * 6.28], amp = [.025 * level * rnd(), .025 * level * rnd()], fr = [1 + rnd() * 2, 1 + rnd() * 2];
    return strokes.map(stroke => stroke.map(([x, y], i) => {
      const u = i / stroke.length;
      let px = (x - .5) * sx, py = (y - .5) * sy;
      px += shear * py;
      const c = Math.cos(rot), s = Math.sin(rot);
      return [px * c - py * s + .5 + gauss() * .005 * level + amp[0] * Math.sin(u * 6.28 * fr[0] + ph[0]), px * s + py * c + .5 + gauss() * .005 * level + amp[1] * Math.sin(u * 6.28 * fr[1] + ph[1])];
    }));
  };
  for (const [lo, hi, minAccuracy, minAccepted] of [[.5, 1, .98, .85], [1, 1.5, .95, .7]]) {
    let ok = 0, accepted = 0, n = 0;
    for (const spell of S.spells) for (let k = 0; k < 200; k++) {
      const best = R.recognize(hand(spell.strokes, lo + rnd() * (hi - lo)), prepared)[0];
      n++;
      if (best.id === spell.id) { ok++; if (best.distance <= R.ACCEPT) accepted++; }
    }
    assert.ok(ok / n >= minAccuracy, `accuracy at level ${lo}-${hi}: ${(ok / n).toFixed(3)}`);
    assert.ok(accepted / n >= minAccepted, `accepted at level ${lo}-${hi}: ${(accepted / n).toFixed(3)}`);
    console.log(`PASS recogniser level ${lo}-${hi}: ${(ok / n * 100).toFixed(1)}% right, ${(accepted / n * 100).toFixed(1)}% accepted`);
  }
  let scribblesAccepted = 0;
  for (let k = 0; k < 400; k++) {
    const pts = []; let x = .5, y = .5, a = rnd() * 6.28;
    for (let i = 0; i < 60; i++) { a += gauss() * .5; x += Math.cos(a) * .03; y += Math.sin(a) * .03; pts.push([x, y]); }
    if (R.recognize([pts], prepared)[0].distance <= R.ACCEPT) scribblesAccepted++;
  }
  assert.ok(scribblesAccepted / 400 <= .05, `scribbles accepted: ${scribblesAccepted}/400`);
  console.log(`PASS recogniser rejects scribbles (${scribblesAccepted}/400 accepted)`);
  // A triangle drawn apex down is not Flame, and a horizontal line is not Mirror.
  const flipped = S.byId.flame.strokes.map(s => s.map(([x, y]) => [x, 1 - y]));
  assert.notEqual(R.recognize(flipped, prepared)[0].id === 'flame' && R.recognize(flipped, prepared)[0].distance <= R.ACCEPT, true);
  const flat = [[[.1, .5], [.5, .5], [.9, .5]]];
  const flatBest = R.recognize(flat, prepared)[0];
  assert.ok(!(flatBest.id === 'mirror' && flatBest.distance <= R.ACCEPT), 'a flat line is no mirror');
  console.log('PASS recogniser: orientation matters');

  // Balance: each option against a uniform opponent and the monster against
  // a uniform player, so the numbers are there to read after play.
  const duel = (pickA, pickB) => {
    let a = S.emptyBody(), b = S.emptyBody(), round = 0;
    const history = [];
    let sa = null, sb = null;
    while (round < 60) {
      round++;
      const ia = pickA(a, b, history, { self: sa, other: sb }), ib = pickB(b, a, history, { self: sb, other: sa });
      sa = S.nextStreak(sa, ia); sb = S.nextStreak(sb, ib);
      const r = S.applyRound(a, b, ia, ib, [S.powerOf(sa), S.powerOf(sb)]);
      a = r.bodies[0]; b = r.bodies[1]; history.push(ib);
      if (r.deaths[0] || r.deaths[1]) return r.deaths[0] && r.deaths[1] ? 'both' : r.deaths[0] ? 'b' : 'a';
    }
    return 'draw';
  };
  const uniform = () => S.OPTIONS[Math.floor(rnd() * S.OPTIONS.length)];
  const lines = [];
  for (const id of S.OPTIONS) {
    const tally = { a: 0, b: 0, both: 0, draw: 0 };
    for (let k = 0; k < 2000; k++) tally[duel(() => id, uniform)]++;
    lines.push(`${S.byId[id].name.padEnd(7)} always: wins ${(tally.a / 20).toFixed(1)}%  loses ${(tally.b / 20).toFixed(1)}%  both ${(tally.both / 20).toFixed(1)}%  draw ${(tally.draw / 20).toFixed(1)}%`);
  }
  const tally = { a: 0, b: 0, both: 0, draw: 0 };
  const monster = S.monsters[0];
  for (let k = 0; k < 2000; k++) tally[duel((self, other, history, streaks) => S.chooseSpell(monster, self, other, history, rnd, streaks), uniform)]++;
  const resting = { a: 0, b: 0, both: 0, draw: 0 };
  for (let k = 0; k < 500; k++) resting[duel((self, other, history, streaks) => S.chooseSpell(monster, self, other, history, rnd, streaks), () => 'rest')]++;
  lines.push(`${monster.name} vs a player who only rests: wins ${(resting.a / 5).toFixed(1)}%  draw ${(resting.draw / 5).toFixed(1)}%`);
  lines.push(`${monster.name} vs uniform player: wins ${(tally.a / 20).toFixed(1)}%  loses ${(tally.b / 20).toFixed(1)}%  both ${(tally.both / 20).toFixed(1)}%  draw ${(tally.draw / 20).toFixed(1)}%`);
  console.log('INFO balance over 2000 duels each\n  ' + lines.join('\n  '));
  assert.ok(tally.a > tally.b, 'the monster should beat a player who draws at random');
  assert.equal(resting.draw, 0, 'resting forever must not stall the duel');
}

async function browser() {
  const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
  const { chromium } = require(toolsPath ? path.join(toolsPath, 'playwright') : 'playwright');
  const base = (process.env.HOUSE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
  const browser = await chromium.launch({ headless: true });
  try {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/glyphs.html');
    await page.waitForFunction(() => window.glyphsDuel);
    // The monster locks at once and always fumbles, so rounds resolve as soon
    // as the player casts and only the player's glyph lands.
    await page.evaluate(() => {
      window.GlyphsSpells.chooseSpell = () => 'fizzle';
      window.glyphsDuel.startDuel();
    });
    const sheet = page.locator('#sheet');
    const box = await sheet.boundingBox();
    const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    const draw = async pts => {
      await page.mouse.move(...pts[0]); await page.mouse.down();
      for (const p of pts.slice(1)) await page.mouse.move(...p, { steps: 5 });
      await page.mouse.up();
    };
    // Nothing moves before Begin: the battlefield is shown, the sheet takes no
    // ink and the clock stands.
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.phase), 'ready');
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'arena');
    assert.equal(await page.locator('#sheet').isVisible(), false);
    assert.equal(await page.locator('#cast').isDisabled(), true);
    await draw([at(.3, .3), at(.7, .7)]);
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.strokes.length), 0);
    assert.equal(await page.locator('#timer-seconds').textContent(), '10');
    await page.click('#begin');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
    assert.equal(await page.locator('#begin').isHidden(), true);
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'sheet');
    assert.equal(await page.locator('#sheet').isVisible(), true);
    await draw([at(.5, .14), at(.86, .82), at(.14, .82), at(.5, .14)]);
    assert.equal(await page.locator('#sheet-state').textContent(), 'the ink sets');
    assert.equal(await page.evaluate(() => window.glyphsDuel.readSheet().id), 'flame');
    await page.click('#cast');
    assert.notEqual(await page.evaluate(() => window.glyphsDuel.state.phase), 'drawing', 'cast resolves at once');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'arena', 'casting shows the battlefield');
    assert.equal(await page.locator('#caster-foe [data-hits] li').first().textContent(), '+1 ember');
    assert.equal(await page.locator('#caster-you [data-hits] li').first().textContent(), 'untouched');
    assert.match(await page.locator('#narration .narration-outcomes').textContent(), /You untouched.*The Salamander \+1 ember/);
    await page.waitForFunction(() => window.glyphsDuel.state.round === 2);
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'sheet', 'the next round shows the sheet');
    const narration = await page.locator('#narration').textContent();
    assert.match(narration, /You cast Flame/);
    assert.match(narration, /finds no answer and lands/);
    assert.equal(await page.locator('#caster-foe [data-state]').textContent(), '1 ember');
    assert.equal(await page.locator('#caster-foe .portrait-marks use').count(), 1);
    assert.equal(await page.locator('#grimoire-list li strong').first().textContent(), 'Flame');
    assert.equal(await page.locator('#stage-name').textContent(), 'lands');
    assert.equal(await page.locator('.stage.is-animating').count(), 0, 'reduced motion skips the stage animation');
    // A blank sheet rests.
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.round === 3);
    assert.match(await page.locator('#narration').textContent(), /You rest, and there was nothing to settle/);
    assert.equal(await page.locator('#caster-you [data-hits] li').first().textContent(), 'rests');
    // A scribble fizzles, and the glow never names a spell.
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
    await draw([at(.2, .3), at(.3, .7), at(.4, .3), at(.5, .7), at(.7, .4), at(.8, .6)]);
    assert.equal(await page.evaluate(() => window.glyphsDuel.readSheet().id), 'fizzle');
    assert.ok(!/flame|wave|stone|wind|ward|mirror/i.test(await page.locator('#sheet-state').textContent()));
    await page.click('#clear');
    assert.equal(await page.evaluate(() => window.glyphsDuel.readSheet().id), 'rest');
    // A flame, then the same flame again: the second lands two marks, and the
    // monster, with one ember already, is ash.
    await draw([at(.5, .14), at(.86, .82), at(.14, .82), at(.5, .14)]);
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.round === 4);
    assert.equal(await page.locator('#caster-foe [data-state]').textContent(), '2 embers');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
    await draw([at(.5, .14), at(.86, .82), at(.14, .82), at(.5, .14)]);
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'ended');
    assert.match(await page.locator('#narration').textContent(), /You cast Flame, twice over/);
    assert.equal(await page.locator('.stage-token[data-token="you"] circle').count(), 1, 'one momentum ring');
    assert.equal(await page.locator('#duel-end-title').textContent(), 'The duel is yours');
    assert.match(await page.locator('#duel-end-line').textContent(), /burnt to ash/);
    assert.equal(await page.locator('#caster-foe').getAttribute('data-death'), 'fire');
    await page.click('#again');
    await page.waitForFunction(() => window.glyphsDuel.state.round === 1 && window.glyphsDuel.state.phase === 'drawing');
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.streaks.you), null);
    assert.equal(await page.locator('#caster-foe [data-state]').textContent(), 'unmarked');
    // The grimoire survives a reload; the house nav returns to the landing.
    await page.reload();
    await page.waitForFunction(() => window.glyphsDuel);
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.phase), 'ready');
    assert.equal(await page.locator('#grimoire-list li strong').first().textContent(), 'Flame');
    await page.locator('.house-room-nav').waitFor();
    assert.equal(await page.locator('.house-return').getAttribute('href'), '/#first-floor');
    assert.equal(await page.locator('#house-return-fallback').count(), 0);
    console.log('PASS duel: waits for Begin on the battlefield, scenes switch on cast and on the next round, cast resolves at once with hit badges and outcome lines, flame recognised and lands, rest, fizzle without a name, momentum, death by fire, duel again, grimoire kept, house return');

    // The round clock runs out on its own.
    const clock = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
    clock.on('pageerror', error => errors.push(error.message));
    await clock.goto(base + '/glyphs.html');
    await clock.waitForFunction(() => window.glyphsDuel);
    await clock.evaluate(() => { window.glyphsDuel.startDuel(); window.glyphsDuel.beginDuel(); });
    await clock.waitForFunction(() => window.glyphsDuel.state.round === 2, null, { timeout: 15000 });
    await clock.close();
    console.log('PASS the clock resolves a round after ten seconds');

    // The grimoire page is complete and the pad reads a drawing.
    const grimoire = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    grimoire.on('pageerror', error => errors.push(error.message));
    await grimoire.goto(base + '/glyphs-grimoire.html');
    await grimoire.locator('#spell-list li').first().waitFor();
    assert.equal(await grimoire.locator('#spell-list li').count(), S.spells.length + 2);
    assert.equal(await grimoire.locator('#matrix thead th').count(), S.OPTIONS.length + 2);
    assert.equal(await grimoire.locator('#spell-list li').filter({ hasText: 'Bolt' }).count(), 1);
    assert.equal(await grimoire.locator('#matrix tbody tr').count(), S.OPTIONS.length + 1);
    assert.equal(await grimoire.locator('#deaths tbody tr').count(), 4);
    assert.equal(await grimoire.locator('#monster-list li').count(), S.monsters.length);
    await grimoire.locator('#pad').scrollIntoViewIfNeeded();
    const pad = await grimoire.locator('#pad').boundingBox();
    const circle = Array.from({ length: 41 }, (_, i) => [pad.x + pad.width * (.5 + .34 * Math.cos(i / 40 * Math.PI * 2)), pad.y + pad.height * (.5 + .34 * Math.sin(i / 40 * Math.PI * 2))]);
    await grimoire.mouse.move(...circle[0]); await grimoire.mouse.down();
    for (const p of circle.slice(1)) await grimoire.mouse.move(...p, { steps: 2 });
    await grimoire.mouse.up();
    assert.match(await grimoire.locator('#pad-reading').textContent(), /Reads as Ward/);
    assert.equal(await grimoire.locator('.house-room-nav').count(), 0, 'the grimoire is not a room');
    await grimoire.close();
    console.log('PASS grimoire page: spells, matrix, deaths, monsters, test pad');

    // Two phones: a server of this tree is started on its own port so the duel
    // module under test is the one in the working copy.
    const ONLINE_PORT = 8097;
    const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(ONLINE_PORT) }, stdio: 'ignore' });
    try {
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const probe = () => http.get(`http://127.0.0.1:${ONLINE_PORT}/glyphs.html`, res => { let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => /glyphs-server|Glyphs/.test(body) ? resolve() : reject(new Error('another server answers on the test port'))); }).on('error', () => Date.now() - started > 8000 ? reject(new Error('test server did not start')) : setTimeout(probe, 150));
        probe();
      });
      const onlineBase = `http://127.0.0.1:${ONLINE_PORT}`;
      const host = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const guest = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      for (const p of [host, guest]) p.on('pageerror', error => errors.push(error.message));
      await host.goto(onlineBase + '/glyphs.html');
      await host.waitForFunction(() => window.glyphsDuel);
      await host.click('#friend');
      await host.locator('#online-host:not([hidden])').waitFor();
      const code = await host.locator('#online-code').textContent();
      assert.match(code, /^[A-Z]{4}$/);
      assert.equal(await host.locator('#online-link').getAttribute('href'), `${onlineBase}/glyphs.html#duel=${code}`);
      await guest.goto(`${onlineBase}/glyphs.html#duel=${code}`);
      await guest.waitForFunction(() => window.glyphsDuel && window.glyphsDuel.state.phase === 'drawing');
      await host.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
      assert.equal(await host.locator('#foe-name').textContent(), 'The other caster');
      assert.equal(await host.locator('.duel').getAttribute('data-scene'), 'sheet');
      // The host draws a flame and casts; the guest leaves the sheet blank and
      // casts a rest. Each side sees the round from its own chair.
      const hb = await host.locator('#sheet').boundingBox();
      const hat = (fx, fy) => [hb.x + hb.width * fx, hb.y + hb.height * fy];
      await host.mouse.move(...hat(.5, .14)); await host.mouse.down();
      for (const p of [hat(.86, .82), hat(.14, .82), hat(.5, .14)]) await host.mouse.move(...p, { steps: 5 });
      await host.mouse.up();
      await host.click('#cast');
      assert.match(await host.locator('#sheet-state').textContent(), /waiting for the other caster/);
      await guest.waitForFunction(() => document.getElementById('quill').dataset.quill === 'sealed');
      await guest.click('#cast');
      await host.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
      await guest.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
      assert.match(await host.locator('#narration').textContent(), /You cast Flame/);
      assert.equal(await host.locator('#caster-foe [data-state]').textContent(), '1 ember');
      assert.match(await guest.locator('#narration').textContent(), /You rest/);
      assert.equal(await guest.locator('#caster-you [data-state]').textContent(), '1 ember');
      assert.equal(await guest.locator('#caster-you [data-hits] li').first().textContent(), '+1 ember');
      assert.equal(await guest.locator('#grimoire-list li').count(), 0, 'a rest writes nothing');
      assert.equal(await host.locator('#grimoire-list li strong').first().textContent(), 'Flame');
      // The server opens round two for both.
      await host.waitForFunction(() => window.glyphsDuel.state.round === 2 && window.glyphsDuel.state.phase === 'drawing', null, { timeout: 15000 });
      await guest.waitForFunction(() => window.glyphsDuel.state.round === 2 && window.glyphsDuel.state.phase === 'drawing');
      // A guest who leaves ends the duel at the host's table.
      await guest.close();
      await host.waitForFunction(() => window.glyphsDuel.net.mode === 'monster' && window.glyphsDuel.state.phase === 'ready');
      assert.match(await host.locator('#narration').textContent(), /left the table/);
      assert.equal(await host.locator('#foe-name').textContent(), 'The Salamander');
      // A wrong code is refused politely.
      await host.click('#friend');
      await host.locator('#online-host:not([hidden])').waitFor();
      await host.fill('#online-input', 'ZZZZ');
      await host.click('#online-join button');
      await host.waitForFunction(() => /No duel is waiting/.test(document.getElementById('online-status').textContent));
      await host.close();
      console.log('PASS two phones: table code and link, both sheets sealed by the server, each side sees its own perspective, round two opens, leaving ends the duel, wrong code refused');
    } finally {
      server.kill();
    }

    // A phone fits without sideways scrolling.
    const phone = await browser.newPage({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(base + '/glyphs.html');
    await phone.waitForFunction(() => window.glyphsDuel);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await phone.goto(base + '/glyphs-grimoire.html');
    await phone.locator('#spell-list li').first().waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await phone.close();
    assert.deepEqual(errors, []);
    console.log('PASS phone viewport without horizontal overflow, and no JavaScript errors');
  } finally {
    await browser.close();
  }
}

(async () => {
  unit();
  if (!process.argv.includes('--unit')) await browser();
})().catch(error => { console.error(error); process.exit(1); });
