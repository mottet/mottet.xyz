'use strict';

// Maia's site checks. `--unit` runs the store, the cookie and the words in
// Node alone; `--browser` starts its own server on a spare port with a data
// folder and passwords of its own, and drives the gate, both roles, a feed
// seen live from a second phone, a journal page with a photo and news in
// three languages through Playwright (HOUSE_TEST_TOOLS). With neither flag
// both run.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const Maia = require('../maia-server.js');
const I = require('../maia/maia-i18n.js');

const PORT = 8097;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'maia-check-'));

function unit() {
  // The store: a line per write, the latest wins, a delete hides, a torn line is skipped.
  const dir = tmp();
  let store = Maia.openStore(dir);
  const a = store.put({ id: 'aaaaaaaa', type: 'feed', side: 'left', start: '2026-11-07T10:00:00.000Z', end: null });
  assert.equal(a.rev, 1);
  store.put({ id: 'aaaaaaaa', type: 'feed', side: 'left', start: '2026-11-07T10:00:00.000Z', end: '2026-11-07T10:20:00.000Z' });
  store.put({ id: 'bbbbbbbb', type: 'news', on: '2026-11-07', title: { fr: 'Salut' }, text: {}, photos: ['cccccccc'] });
  store.put({ id: 'cccccccc', type: 'photo', ext: 'jpg', audience: 'family' });
  store.put({ id: 'dddddddd', type: 'photo', ext: 'jpg', audience: 'parents' });
  store.put({ id: 'dddddddd', type: 'photo', deleted: true });
  fs.appendFileSync(store.file, '{"id":"eeeeeeee","type":"feed"'); // the power went while writing
  store = Maia.openStore(dir);
  assert.equal(store.rev, 6);
  assert.equal(store.records.get('aaaaaaaa').end, '2026-11-07T10:20:00.000Z', 'the latest line wins');
  assert.deepEqual(store.visible('parents').map(r => r.id), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'], 'a deleted record is hidden');
  assert.deepEqual(store.visible('family').map(r => r.id), ['bbbbbbbb', 'cccccccc'], 'the family sees news and its photos only');
  assert.equal(store.put({ id: 'ffffffff', type: 'care' }).rev, 7, 'the counter carries on after a reload');
  // What a record keeps of what the phone sends.
  const feed = Maia.SHAPES.feed({ side: 'up', start: 'yesterday', end: '2026-11-07T10:20:00Z', note: 'x'.repeat(600), junk: 1 });
  assert.equal(feed.side, 'left'); assert.ok(!Number.isNaN(Date.parse(feed.start))); assert.equal(feed.end, '2026-11-07T10:20:00.000Z'); assert.equal(feed.note.length, 500); assert.equal('junk' in feed, false);
  assert.deepEqual(Maia.SHAPES.news({ on: '2026-11-07', title: { fr: 'A', de: 'B' }, text: 'no', photos: ['cccccccc', 'bad id'] }), { on: '2026-11-07', title: { fr: 'A' }, text: {}, photos: ['cccccccc'] });
  assert.equal(Maia.SHAPES.journal({ on: '7 nov', weight: '3500' }).weight, null, 'numbers must be numbers');
  // The cookie: signed, with a role and an expiry; a changed byte is nobody.
  const secrets = tmp() + '/s.json';
  fs.writeFileSync(secrets, JSON.stringify({ parents: 'parents-word', family: 'family-word', cookieSecret: 'c'.repeat(32) }));
  const site = Maia({ dir: tmp(), secrets });
  const cookie = site.cookieFor('family').split(';')[0].split('=')[1];
  const req = c => ({ headers: { cookie: `other=1; maia=${c}` } });
  assert.equal(site.roleOf(req(cookie)), 'family');
  assert.equal(site.roleOf(req(cookie.replace(/.$/, c => (c === 'A' ? 'B' : 'A')))), null, 'a changed signature');
  assert.equal(site.roleOf(req(cookie.replace('family', 'parents'))), null, 'a changed role');
  assert.equal(site.roleOf({ headers: {} }), null);
  assert.equal(site.roleOf(req(`family.${Date.now() - 1000}.${Maia.sign('c'.repeat(32), `family.${Date.now() - 1000}`)}`)), null, 'expired');
  assert.equal(Maia({ dir: tmp(), secrets: '/nowhere' }).readSecrets(), null, 'no secrets, no roles');
  // The words: her age, and a post in the reader's language or the next best.
  const born = '2026-11-04T20:44:00+01:00';
  assert.equal(I.age('en', born, new Date(2026, 10, 7, 12)), '3 days old');
  assert.equal(I.age('fr', born, new Date(2026, 10, 5, 1)), '1 jour');
  assert.equal(I.age('zh', born, new Date(2026, 10, 20, 12)), '2 週又 2 天大');
  assert.equal(I.age('en', born, new Date(2026, 11, 2, 12)), '4 weeks old');
  assert.equal(I.age('en', born, new Date(2027, 1, 10, 12)), '3 months and 6 days old');
  assert.equal(I.age('fr', born, new Date(2027, 2, 4, 12)), '4 mois');
  assert.equal(I.age('en', born, new Date(2027, 2, 3, 12)), '3 months and 27 days old', 'the month turns on the 4th');
  assert.equal(I.pick({ fr: 'Bonjour', en: 'Hello' }, 'zh'), 'Bonjour', 'a missing translation falls back in wheel order');
  assert.equal(I.pick({ zh: '你好' }, 'en'), '你好');
  assert.equal(I.pick({}, 'en'), '');
  assert.equal(I.t('zh', 'days', { n: 3 }), '3 天大');
  assert.match(I.t('fr', 'born', { date: '4 novembre 2026', time: '20:44' }), /Née le 4 novembre 2026 à 20:44/);
  console.log('PASS unit: the store, record shapes, the cookie, her age and the three languages');
}

async function browser() {
  const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
  assert.ok(toolsPath, 'Set HOUSE_TEST_TOOLS to a node_modules folder holding playwright.');
  const { chromium } = require(path.join(toolsPath, 'playwright'));
  const data = tmp(), secretsFile = path.join(tmp(), 'secrets.json');
  const secrets = { parents: 'the-parents-word', family: 'the-family-word', cookieSecret: 'k'.repeat(40) };
  fs.writeFileSync(secretsFile, JSON.stringify(secrets));
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MAIA_DATA: data, MAIA_SECRETS: secretsFile }, stdio: 'ignore' });
  const base = `http://maia.localhost:${PORT}`;
  const get = (url, headers = {}) => new Promise((resolve, reject) => http.get(url, { headers }, res => { let body = ''; res.on('data', d => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); }).on('error', reject));
  for (let i = 0; i < 50; i++) { try { await get(`http://127.0.0.1:${PORT}/`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const browserInstance = await chromium.launch();
  const errors = [];
  const phone = async (opts = {}) => { const ctx = await browserInstance.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...opts }); const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); return page; };
  const login = async (page, word) => { await page.goto(base + '/'); await page.fill('input[name=password]', word); await page.click('[data-form=login] button[type=submit]'); };
  try {
    // The host keeps the two sites apart.
    const house = await get(`http://127.0.0.1:${PORT}/`);
    assert.match(house.body, /house of little experiments/, 'the house still answers on its own host');
    const maiaOnHouse = await get(`http://127.0.0.1:${PORT}/maia.js`);
    assert.equal(maiaOnHouse.status, 404, 'nothing of Maia on the house host');
    const houseOnMaia = await get(`http://127.0.0.1:${PORT}/glyphs.html`, { host: 'maia.localhost' });
    assert.equal(houseOnMaia.status, 404, 'nothing of the house on Maia\'s host');
    const index = await get(`http://127.0.0.1:${PORT}/`, { host: 'maia.localhost' });
    assert.equal(index.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal((await get(`http://127.0.0.1:${PORT}/api/records`, { host: 'maia.localhost' })).status, 401, 'records need a role');

    // The gate, in three languages, and the parents come in.
    const page = await phone({ locale: 'fr-FR' });
    await page.goto(base + '/');
    await page.waitForSelector('[data-form=login]');
    assert.equal(await page.locator('[data-lang=fr]').getAttribute('aria-pressed'), 'true', 'French phone, French gate');
    assert.match(await page.locator('.masthead .tagline').textContent(), /Née le 4 novembre 2026 à 20:44/);
    await page.click('[data-lang=zh]');
    assert.equal(await page.locator('.gate button[type=submit]').textContent(), '進來');
    await page.click('[data-lang=en]');
    await page.fill('input[name=password]', 'nope'); await page.click('.gate button[type=submit]');
    await page.waitForFunction(() => document.querySelector('.gate .error').textContent.includes('not the word'));
    await page.fill('input[name=password]', secrets.parents); await page.click('.gate button[type=submit]');
    await page.waitForSelector('#view-today');
    assert.equal(await page.locator('.tabs a').count(), 5);
    assert.match(await page.locator('.masthead .age').textContent(), /Today she is/);

    // A feed starts on one phone and is stopped from the other.
    await page.click('[data-action=start-feed][data-side=right]');
    await page.waitForSelector('[data-action=stop-feed]');
    assert.match(await page.locator('#feed-now').textContent(), /Feeding, right/);
    const other = await phone();
    await login(other, secrets.parents);
    await other.waitForSelector('[data-action=stop-feed]', { timeout: 5000 });
    await other.click('[data-action=stop-feed]');
    await page.waitForSelector('[data-action=start-feed][data-side=left]', { timeout: 5000 });
    assert.match(await page.locator('#view-today .note').first().textContent(), /Last feed just now: right, 0 min\. Next, left\./);
    assert.equal(await page.locator('[data-action=start-feed][data-side=left]').getAttribute('class'), 'btn btn-big btn-primary', 'the other side is suggested');
    await page.click('[data-action=vitamin]');
    await page.waitForSelector('[data-action=vitamin][aria-pressed=true]');
    await other.waitForSelector('[data-action=vitamin][aria-pressed=true]', { timeout: 5000 });
    await page.click('a[href="#feeds"]'); await page.waitForSelector('#view-feeds');
    assert.equal(await page.locator('#view-feeds .list li').count(), 1);
    await page.click('#view-feeds .list [data-action=edit-feed]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog textarea[name=note]', 'Slept after'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    await page.waitForFunction(() => document.querySelector('#view-feeds .list small')?.textContent === 'Slept after');

    // A page of the journal with a photo, and the family must not see that photo.
    await page.click('a[href="#journal"]'); await page.waitForSelector('#view-journal');
    await page.click('[data-action=add-journal]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog input[name=title]', 'First days'); await page.fill('dialog textarea[name=text]', 'She sleeps.'); await page.fill('dialog input[name=weight]', '3420');
    await page.setInputFiles('dialog input[type=file]', { name: 'p.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '..', 'maia', 'icon-192.png')) });
    await page.waitForSelector('dialog [data-detach]');
    await page.click('dialog button[type=submit]');
    await page.waitForSelector('#view-journal .entry img');
    assert.match(await page.locator('#view-journal .measures').textContent(), /3\.420 kg/);
    const photoUrl = await page.locator('#view-journal .entry img').getAttribute('src');
    assert.deepEqual(await page.evaluate(async url => { const r = await fetch(url); return [r.status, r.headers.get('content-type')]; }, photoUrl), [200, 'image/jpeg'], 'the phone sent a JPEG');

    // News for the family, from the journal page, in three languages.
    await page.click('[data-action=share-journal]'); await page.waitForSelector('dialog[open]');
    assert.equal(await page.inputValue('dialog input[name=title_en]'), 'First days');
    await page.fill('dialog input[name=title_fr]', 'Premiers jours'); await page.fill('dialog textarea[name=text_fr]', 'Elle dort.');
    await page.fill('dialog input[name=title_zh]', '頭幾天');
    await page.click('dialog button[type=submit]'); await page.waitForSelector('dialog[open]', { state: 'detached' });
    await page.click('a[href="#news"]'); await page.waitForSelector('#view-news .entry');
    assert.match(await page.locator('#view-news .entry .date').textContent(), /FR EN ZH/);

    const family = await phone({ locale: 'zh-TW' });
    await login(family, secrets.family);
    await family.waitForSelector('.entry');
    assert.equal(await family.locator('.tabs').count(), 0, 'no tools for the family');
    assert.equal(await family.locator('.entry h3').textContent(), '頭幾天');
    assert.equal(await family.locator('.entry .text').textContent(), 'Elle dort.', 'no Chinese text: the first written language');
    assert.equal(await family.locator('html').getAttribute('lang'), 'zh-Hant');
    await family.click('[data-lang=en]');
    assert.equal(await family.locator('.entry h3').textContent(), 'First days');
    assert.equal(await family.locator('.entry .text').textContent(), 'She sleeps.');
    assert.equal(await family.evaluate(async url => (await fetch(url)).status, photoUrl), 200, 'the photo went to the family with the news');
    assert.equal(await family.evaluate(async () => (await fetch('/api/records')).json().then(b => b.records.map(r => r.type).sort().join(','))), 'news,photo', 'nothing else leaks');
    assert.equal(await family.evaluate(async () => (await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"feed"}' })).status), 403, 'the family cannot write');
    // Live for the family too: a second post appears without a reload.
    await page.click('[data-action=add-news]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog input[name=title_en]', 'A smile'); await page.click('dialog button[type=submit]');
    await family.waitForFunction(() => document.querySelectorAll('.entry').length === 2, null, { timeout: 5000 });

    // Care: an appointment shows on Today and can be ticked done.
    await page.click('a[href="#care"]'); await page.waitForSelector('#view-care');
    await page.click('[data-action=add-appointment]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog input[name=title]', 'Pediatrician'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('#view-care .list li');
    await page.click('a[href="#today"]'); await page.waitForSelector('#view-today');
    assert.match(await page.locator('#view-today').textContent(), /Pediatrician/);
    await page.click('a[href="#care"]'); await page.waitForSelector('#view-care');
    await page.click('[data-action=toggle-appointment]');
    await page.waitForSelector('#view-care .what.done');

    // Night mode is remembered; reduced motion slows the clock without breaking it.
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'day');
    await page.click('[data-action=theme]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'night');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.art-header .moon')).display), 'block', 'the moon is up');
    await page.reload(); await page.waitForSelector('#view-care', { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'night', 'night stays after a reload, and so does the tab');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('a[href="#today"]'); await page.waitForSelector('#view-today');
    await page.click('[data-action=start-feed][data-side=both]'); await page.waitForSelector('.timer');
    assert.match(await page.locator('.timer').textContent(), /^\d+:\d\d/);
    await page.click('[data-action=stop-feed]'); await page.waitForSelector('[data-action=start-feed]');

    // Leaving clears the cookie.
    await page.click('[data-action=logout]'); await page.waitForSelector('[data-form=login]');
    assert.equal(await page.evaluate(async () => (await fetch('/api/records')).status), 401);

    // A wide screen keeps the tabs at the top and everything in one column.
    const wide = await browserInstance.newPage({ viewport: { width: 1200, height: 900 } });
    await login(wide, secrets.parents); await wide.waitForSelector('#view-today');
    const tabsBox = await wide.locator('.tabs').boundingBox();
    assert.ok(tabsBox.y < 400, 'tabs under the masthead on a wide screen');
    assert.equal(await wide.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS browser: two hosts, the gate in three languages, a feed stopped from the other phone, a journal page with a photo, news read by the family in its language, care, night mode, reduced motion, leaving, a wide screen');
  } finally {
    await browserInstance.close();
    server.kill();
    fs.rmSync(data, { recursive: true, force: true });
  }
}

(async () => {
  if (!process.argv.includes('--browser')) unit();
  if (!process.argv.includes('--unit')) await browser();
})().catch(error => { console.error(error); process.exit(1); });
