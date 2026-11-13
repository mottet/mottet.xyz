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
const Push = require('../maia-push.js');
const express = require('express');
const I = require('../maia/maia-i18n.js');

const PORT = 8097;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'maia-check-'));

async function unit() {
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
  assert.deepEqual(Maia.SHAPES.feed({ start: '2026-11-07T10:00:00Z', pauses: [{ start: '2026-11-07T10:05:00Z', end: null }, { start: 'nope' }, 'x'] }).pauses, [{ start: '2026-11-07T10:05:00.000Z', end: null }], 'a feed keeps its pauses, an open one included');
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
  await reminders();
  console.log('PASS unit: the store, record shapes, the cookie, her age, the three languages and the reminders');
}

// The reminders: what the planner says is due, once each, in her time zone.
async function reminders() {
  const T = s => Date.parse(s);
  const records = list => new Map(list.map(r => [r.id, r]));
  const phone = (id, settings = {}) => ({ id, role: 'parents', endpoint: `https://push.example/${id}`, keys: { p256dh: 'p', auth: 'a' }, settings: Push.shapeSettings(settings) });
  const two = [phone('p1'), phone('p2', { vitaminAt: '09:00', noFeed: false })];
  const keys = (recs, now, subs = two, sent = {}) => Push.plan({ records: records(recs), subscriptions: subs, now: T(now), sent }).map(r => `${r.key}>${r.to.join('+')}`);

  // Vitamin D at each phone's hour, a second nudge three hours on, nothing once given.
  assert.deepEqual(keys([], '2026-11-08T08:30:00+01:00'), []);
  assert.deepEqual(keys([], '2026-11-08T09:10:00+01:00'), ['vit:2026-11-08:p2>p2']);
  assert.deepEqual(keys([], '2026-11-08T10:00:00+01:00'), ['vit:2026-11-08:p1>p1', 'vit:2026-11-08:p2>p2']);
  assert.deepEqual(keys([], '2026-11-08T13:30:00+01:00'), ['vit:2026-11-08:p1>p1', 'vit2:2026-11-08:p1>p1', 'vit:2026-11-08:p2>p2', 'vit2:2026-11-08:p2>p2']);
  assert.deepEqual(keys([], '2026-11-08T13:30:00+01:00', two, { 'vit:2026-11-08:p1': 1, 'vit:2026-11-08:p2': 1, 'vit2:2026-11-08:p2': 1 }), ['vit2:2026-11-08:p1>p1'], 'what was sent is not sent again');
  assert.deepEqual(keys([{ id: 'v1', type: 'care', kind: 'vitamin', at: '2026-11-08T07:00:00+01:00' }], '2026-11-08T13:30:00+01:00'), [], 'given early this morning, Paris time');
  assert.deepEqual(keys([{ id: 'v1', type: 'care', kind: 'vitamin', at: '2026-11-07T23:30:00+01:00' }], '2026-11-08T10:00:00+01:00').length, 2, 'given last night counts for yesterday');
  const noVit = [phone('p1', { vitamin: false })];
  // Appointments: the evening before at seven, and an hour before; not when done or long past.
  const appt = { id: 'a1', type: 'appointment', title: 'Pediatrician', place: 'Rue des Lilas', at: '2026-11-09T14:00:00+01:00' };
  assert.deepEqual(keys([appt], '2026-11-08T18:59:00+01:00', noVit), []);
  assert.deepEqual(keys([appt], '2026-11-08T19:00:00+01:00', noVit), ['appt:a1:eve:2026-11-09T14:00:00+01:00>p1']);
  assert.deepEqual(keys([appt], '2026-11-09T12:59:00+01:00', noVit), []);
  const plan1h = Push.plan({ records: records([appt]), subscriptions: noVit, now: T('2026-11-09T13:00:00+01:00') });
  assert.deepEqual(plan1h.map(r => r.key), ['appt:a1:1h:2026-11-09T14:00:00+01:00']);
  assert.equal(plan1h[0].body, 'Pediatrician at Rue des Lilas, 14:00.');
  assert.deepEqual(keys([{ ...appt, done: true }], '2026-11-09T13:00:00+01:00', noVit), []);
  assert.deepEqual(keys([appt], '2026-11-09T15:00:00+01:00', noVit), [], 'half an hour after, it is too late to say');
  assert.deepEqual(keys([appt], '2026-11-09T13:00:00+01:00', [phone('p1', { vitamin: false, appointments: false })]), []);
  // A feed running forty minutes; none for two and a half hours, then every thirty minutes; silence after twelve.
  const run = { id: 'f1', type: 'feed', side: 'right', start: '2026-11-08T14:00:00+01:00', end: null };
  const continued = { ...run, pauses: [{ start: '2026-11-08T14:20:00+01:00', end: '2026-11-08T14:50:00+01:00' }] };
  assert.deepEqual(keys([continued], '2026-11-08T15:05:00+01:00', [phone('p1', { vitamin: false })]), [], 'the gap before a continued feed does not count');
  assert.deepEqual(keys([continued], '2026-11-08T15:11:00+01:00', [phone('p1', { vitamin: false })]), ['long:f1>p1']);
  assert.deepEqual(keys([{ ...run, pauses: [{ start: '2026-11-08T14:10:00+01:00', end: null }] }], '2026-11-08T14:41:00+01:00', [phone('p1', { vitamin: false })]), ['long:f1>p1'], 'a feed left paused still rings');
  assert.deepEqual(keys([run], '2026-11-08T14:39:00+01:00', noVit), []);
  const planLong = Push.plan({ records: records([run]), subscriptions: noVit, now: T('2026-11-08T14:41:00+01:00') });
  assert.deepEqual(planLong.map(r => r.key), ['long:f1']);
  assert.equal(planLong[0].body, 'On the right side since 14:00, 41 min ago.');
  const done = { ...run, end: '2026-11-08T14:20:00+01:00' };
  assert.deepEqual(keys([done], '2026-11-08T16:49:00+01:00', noVit), []);
  assert.deepEqual(keys([done], '2026-11-08T16:50:00+01:00', noVit), ['nofeed:f1:0>p1']);
  assert.deepEqual(keys([done], '2026-11-08T17:19:00+01:00', noVit), ['nofeed:f1:0>p1'], 'the same slot until the next one');
  const planGap = Push.plan({ records: records([done]), subscriptions: noVit, now: T('2026-11-08T17:20:00+01:00') });
  assert.deepEqual(planGap.map(r => r.key), ['nofeed:f1:1']);
  assert.equal(planGap[0].body, 'Last one ended 3 h ago, the right side at 14:20.');
  assert.deepEqual(keys([done, { ...run, id: 'f2', start: '2026-11-08T17:30:00+01:00' }], '2026-11-08T17:20:00+01:00', noVit), [], 'a feed under way quiets the gap');
  assert.deepEqual(keys([done], '2026-11-09T03:00:00+01:00', noVit), [], 'twelve hours on, nobody is logging');
  assert.deepEqual(keys([done], '2026-11-08T16:50:00+01:00', [phone('p2', { vitamin: false, noFeed: false })]), [], 'this phone does not want it');
  assert.deepEqual(keys([done], '2026-11-08T16:50:00+01:00', [{ ...phone('f1'), role: 'family' }]), [], 'never the family');

  // The module: keys made once, a phone's choices kept, each reminder sent once, a gone phone dropped, the journal told to the other phone.
  const dir = tmp(); const store = Maia.openStore(dir);
  const sent = [];
  let fail = null;
  const make = () => Push({ dir, store, send: async (sub, message) => { if (fail && sub.id === fail) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push(`${sub.id}:${message.title}`); }, log: () => {} });
  let push = make();
  const key = push.publicKey();
  assert.ok(key.length > 60);
  assert.equal(make().publicKey(), key, 'the key pair is kept on disk');
  assert.equal(push.subscribe('parents', { endpoint: 'http://not-https', keys: { p256dh: 'p', auth: 'a' } }), null);
  const a = push.subscribe('parents', { endpoint: 'https://push.example/aaaa', keys: { p256dh: 'p', auth: 'a' } }, { vitaminAt: '25:00', noFeed: false, vitamin: false, junk: true });
  assert.deepEqual(a.settings, { ...Push.DEFAULTS, noFeed: false, vitamin: false }, 'a bad hour falls back, a stranger is dropped');
  const b = push.subscribe('parents', { endpoint: 'https://push.example/bbbb', keys: { p256dh: 'p', auth: 'a' } }, { vitamin: false });
  assert.equal(push.subscribe('parents', { endpoint: 'https://push.example/aaaa', keys: { p256dh: 'p2', auth: 'a2' } }, { vitaminAt: '08:30' }).id, a.id, 'the same phone keeps its id');
  assert.equal(push.find('https://push.example/aaaa').settings.vitaminAt, '08:30');
  store.put({ id: 'feed0001', type: 'feed', side: 'left', start: '2026-11-08T14:00:00+01:00', end: '2026-11-08T14:20:00+01:00' });
  assert.deepEqual(push.tick(T('2026-11-08T16:50:00+01:00')).map(r => r.key), ['nofeed:feed0001:0']);
  assert.deepEqual(push.tick(T('2026-11-08T16:51:00+01:00')), [], 'not twice');
  push = make();
  assert.deepEqual(push.tick(T('2026-11-08T16:52:00+01:00')), [], 'nor after a restart');
  await push.flush();
  assert.deepEqual(sent, [`${b.id}:No feed for a while`], 'only the phone that wants the gap reminder');
  fail = b.id;
  await push.journal({ id: 'j1', title: 'First smile', text: '' }, a.id); await push.flush();
  assert.deepEqual(sent.length, 1, 'the author is skipped and the gone phone is not reached');
  assert.deepEqual(push.subscriptions.map(x => x.id), [a.id], 'a phone that answers 410 is forgotten');
  const spare = Push({ dir, store, live: false, send: async () => { sent.push('spare'); }, log: () => {} });
  spare.start(); await spare.journal({ id: 'j9', title: 'x', text: '' }, 'nobody'); await spare.flush();
  assert.equal(sent.includes('spare'), false, 'a spare server sends nothing');
  fail = null;
  await push.journal({ id: 'j2', title: '', text: 'She slept   through the night' }, 'someone-else'); await push.flush();
  assert.equal(sent[1], `${a.id}:A page in the journal`);
  assert.equal(Push.journalMessage({ id: 'j2', title: '', text: 'She slept   through the night' }).body, 'She slept through the night');

  // Through the router: a parent phone subscribes, reads its choices back, writes a page and the other phone is told.
  const secrets = tmp() + '/s.json';
  fs.writeFileSync(secrets, JSON.stringify({ parents: 'parents-word', family: 'family-word', cookieSecret: 'c'.repeat(32) }));
  const got = [];
  const site = Maia({ dir: tmp(), secrets, send: async (sub, message) => { got.push(`${sub.id}:${message.title}:${message.url}`); }, log: () => {} });
  const app = express(); app.use(site.middleware);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (route, body, role = 'parents', headers = {}) => fetch(base + route, { method: 'POST', headers: { host: 'maia.localhost', 'content-type': 'application/json', cookie: role ? site.cookieFor(role).split(';')[0] : '', ...headers }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
  try {
    const subA = { endpoint: 'https://push.example/phone-a', keys: { p256dh: 'p', auth: 'a' } }, subB = { endpoint: 'https://push.example/phone-b', keys: { p256dh: 'p', auth: 'a' } };
    assert.equal((await call('/api/push/subscribe', { subscription: subA }, 'family')).status, 403, 'the family gets no reminders');
    assert.equal((await call('/api/push/subscribe', { subscription: subA }, null)).status, 401);
    const first = await call('/api/push/state', { endpoint: subA.endpoint });
    assert.equal(first.body.id, null); assert.equal(first.body.key, site.push.publicKey()); assert.deepEqual(first.body.defaults, Push.DEFAULTS);
    const idA = (await call('/api/push/subscribe', { subscription: subA, settings: { journal: true } })).body.id;
    const idB = (await call('/api/push/subscribe', { subscription: subB, settings: { vitaminAt: '21:15' } })).body.id;
    assert.equal((await call('/api/push/state', { endpoint: subB.endpoint })).body.settings.vitaminAt, '21:15', 'a phone reads its choices back');
    assert.equal((await call('/api/push/subscribe', { subscription: { endpoint: 'ftp://no' } })).status, 400);
    await call('/api/records', { type: 'journal', on: '2026-11-08', title: 'First bath', text: '' }, 'parents', { 'x-maia-push': idA });
    await site.push.flush();
    assert.deepEqual(got, [`${idB}:A page in the journal:/#journal`], 'the other phone hears of the page');
    const page = (await call('/api/records', { type: 'journal', on: '2026-11-08', title: 'First bath', text: 'again' }, 'parents', { 'x-maia-push': idB })).body.record;
    await call('/api/records', { ...page, text: 'edited' }, 'parents', { 'x-maia-push': idB });
    await site.push.flush();
    assert.equal(got.length, 2, 'an edit is not news; a new page from B reaches A');
    assert.equal((await call('/api/push/unsubscribe', { endpoint: subA.endpoint })).body.gone, true);
    assert.equal((await call('/api/push/state', { endpoint: subA.endpoint })).body.id, null);
  } finally { server.close(); }
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
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.tabs a svg')].filter(s => !s.firstElementChild).length), 0, 'every tab has its drawing');
    assert.equal(await page.locator('h1').textContent(), 'Maïa');
    await page.waitForSelector('[data-action=push-on]', { timeout: 5000 });
    assert.match(await page.locator('[aria-labelledby=reminders]').textContent(), /Turn on reminders on this phone/, 'the reminders card offers itself');
    assert.equal(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => Boolean(r))), true, 'the service worker is registered');
    assert.match(await page.locator('.masthead .age').textContent(), /Today she is/);

    // A feed starts on one phone and is stopped from the other.
    await page.click('[data-action=start-feed][data-side=right]');
    await page.waitForSelector('[data-action=stop-feed]');
    assert.match(await page.locator('#feed-now').textContent(), /Feeding, right/);
    const other = await phone();
    await login(other, secrets.parents);
    await other.waitForSelector('[data-action=stop-feed]', { timeout: 5000 });
    // A pause on one phone shows on the other, which can resume it; the clock stands still meanwhile.
    await page.click('[data-action=pause-feed]');
    await page.waitForSelector('[data-action=resume-feed]');
    assert.match(await page.locator('#feed-now').textContent(), /Paused, right/);
    await other.waitForSelector('[data-action=resume-feed]', { timeout: 5000 });
    const frozen = await other.locator('.timer').evaluate(el => el.firstChild.nodeValue);
    await other.waitForTimeout(1300);
    assert.equal(await other.locator('.timer').evaluate(el => el.firstChild.nodeValue), frozen, 'a paused clock stands still');
    await other.click('[data-action=resume-feed]');
    await page.waitForSelector('[data-action=pause-feed]', { timeout: 5000 });
    await page.click('[data-action=pause-feed]'); await other.waitForSelector('[data-action=resume-feed]', { timeout: 5000 });
    const t0 = Date.parse('2026-11-07T10:00:00Z'), m = 60000;
    assert.equal(await page.evaluate(f => window.MaiaApp.feedMs(f), { start: new Date(t0).toISOString(), end: new Date(t0 + 30 * m).toISOString(), pauses: [{ start: new Date(t0 + 10 * m).toISOString(), end: new Date(t0 + 15 * m).toISOString() }] }), 25 * m, 'paused minutes do not count'); 
    assert.deepEqual(await page.evaluate(f => window.MaiaApp.activeSpans(f), { start: new Date(t0).toISOString(), end: new Date(t0 + 30 * m).toISOString(), pauses: [{ start: new Date(t0 + 10 * m).toISOString(), end: new Date(t0 + 15 * m).toISOString() }] }), [[t0, t0 + 10 * m], [t0 + 15 * m, t0 + 30 * m]], 'the strip draws the feed without its pause');
    await other.click('[data-action=stop-feed]');
    await page.waitForSelector('[data-action=start-feed][data-side=left]', { timeout: 5000 });
    assert.match(await page.locator('#view-today .note').first().textContent(), /Last feed just now: right, 0 min\. Next, left\./);
    assert.equal(await page.locator('[data-action=start-feed][data-side=left]').getAttribute('class'), 'btn btn-big btn-primary', 'the other side is suggested');
    // Stopped too early: the last feed can be continued, from either phone; the gap becomes a pause.
    await other.waitForSelector('[data-action=continue-feed]', { timeout: 5000 });
    await page.click('[data-action=continue-feed]');
    await other.waitForSelector('[data-action=stop-feed]', { timeout: 5000 });
    assert.match(await page.locator('#feed-now').textContent(), /Feeding, right/, 'the same feed, on the same side');
    assert.equal(await page.evaluate(() => window.MaiaApp.feeds().length), 1, 'no new feed');
    assert.equal(await page.evaluate(() => window.MaiaApp.feeds()[0].pauses.filter(p => p.end).length), 3, 'the gap is kept as a pause');
    await page.click('[data-action=stop-feed]');
    await other.waitForSelector('[data-action=start-feed][data-side=left]', { timeout: 5000 });
    await page.click('[data-action=vitamin]');
    await page.waitForSelector('[data-action=vitamin][aria-pressed=true]');
    await other.waitForSelector('[data-action=vitamin][aria-pressed=true]', { timeout: 5000 });
    await page.click('a[href="#feeds"]'); await page.waitForSelector('#view-feeds');
    // The rhythm: a strip for today with the feed on it, the day's bar, a tooltip on tap, and the page still fits the phone.
    await page.waitForSelector('.rhythm');
    assert.equal(await page.locator('.rhythm .strip:not(.strip-axis)').count(), 1, 'one strip: the log began today');
    const pieces = await page.locator('.rhythm .feed-mark.side-right').evaluateAll(l => l.map(el => el.dataset.tip));
    assert.ok(pieces.length > 1, 'a feed with pauses is drawn in pieces, the pauses left empty');
    assert.equal(new Set(pieces).size, 1, 'every piece tells the same feed');
    assert.equal(await page.locator('.rhythm .bar-col').count(), 1);
    assert.match(await page.locator('.rhythm .rhythm-stats').textContent(), /1\s*feeds in 24 h/);
    const markBox = await page.locator('.rhythm .feed-mark').first().boundingBox();
    await page.touchscreen.tap(markBox.x + markBox.width / 2, markBox.y + markBox.height / 2);
    assert.match(await page.locator('.chart-tip').textContent(), /^Right, \d\d:\d\d–\d\d:\d\d · 0 min \(3 pauses\)$/);
    assert.equal(await page.evaluate(() => window.MaiaApp.feeds()[0].pauses.every(p => p.end)), true, 'stopping while paused closes the pause');
    assert.equal(await page.locator('.chart-tip').isVisible(), true, 'a tap shows the tooltip and it stays');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true, 'the charts fit the phone');
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
    if (await page.locator('dialog details.recent').count()) assert.equal(await page.locator('dialog details.recent').getAttribute('open'), null, 'recent photos start folded');
    assert.equal(await page.inputValue('dialog input[name=title_en]'), 'First days');
    // Several photos on one news: add two more, move the last one earlier, take the middle one back.
    const icon = n => ({ name: `i${n}.png`, mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, '..', 'maia', `icon-${n}.png`)) });
    await page.setInputFiles('dialog input[type=file]', [icon(512), icon(192)]);
    await page.waitForFunction(() => document.querySelectorAll('dialog .thumb.attached').length === 3, null, { timeout: 10000 });
    assert.match(await page.locator('dialog [data-add-label]').textContent(), /Add more photos/);
    const attachedSrcs = () => page.locator('dialog .thumb.attached img').evaluateAll(l => l.map(i => i.getAttribute('src')));
    const [j, a, b] = await attachedSrcs();
    assert.equal(j, photoUrl, 'the journal photo comes first');
    assert.equal(await page.locator('dialog .thumb.attached').first().locator('[data-earlier]').count(), 0, 'the first photo cannot move earlier');
    await page.locator('dialog .thumb.attached').nth(2).locator('[data-earlier]').click();
    assert.deepEqual(await attachedSrcs(), [j, b, a]);
    await page.locator('dialog .thumb.attached').nth(1).locator('[data-detach]').click();
    assert.deepEqual(await attachedSrcs(), [j, a], 'a tap on the cross takes one photo back');
    await page.locator('dialog .thumb.attached img').first().click();
    assert.equal(await page.locator('dialog .thumb.attached').count(), 2, 'a tap on the picture itself removes nothing');
    await page.fill('dialog input[name=title_fr]', 'Premiers jours'); await page.fill('dialog textarea[name=text_fr]', 'Elle dort.');
    await page.fill('dialog input[name=title_zh]', '頭幾天');
    await page.click('dialog button[type=submit]'); await page.waitForSelector('dialog[open]', { state: 'detached' });
    await page.click('a[href="#news"]'); await page.waitForSelector('#view-news .entry');
    assert.match(await page.locator('#view-news .entry .langs').textContent(), /FR EN ZH/);

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
    assert.equal(await family.evaluate(async url => (await fetch(url)).status, b), 404, 'a photo taken back before publishing stays with the parents');
    assert.equal(await family.evaluate(async () => (await fetch('/api/records')).json().then(r => r.records.map(x => x.type).sort().join(','))), 'news,photo,photo', 'nothing else leaks');
    // The two photos of the news are a gallery: whole photos, a count, arrows.
    assert.deepEqual(await family.locator('.entry .gallery .slide img').evaluateAll(l => l.map(i => i.getAttribute('src'))), [j, a]);
    assert.equal(await family.locator('.entry .gallery .count').textContent(), '1 / 2');
    assert.equal(await family.locator('.entry .gallery [data-dir="-1"]').isDisabled(), true);
    assert.match(await family.locator('.entry .gallery [data-dir="1"]').getAttribute('aria-label'), /Next photo/);
    await family.click('.entry .gallery [data-dir="1"]');
    await family.waitForFunction(() => document.querySelector('.entry .gallery .count').textContent === '2 / 2', null, { timeout: 5000 });
    assert.equal(await family.locator('.entry .gallery [data-dir="1"]').isDisabled(), true, 'no further than the last photo');
    assert.equal(await family.evaluate(async () => (await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"feed"}' })).status), 403, 'the family cannot write');
    // The family link: the family password in the address lets a reader in, then leaves the address bar.
    const linked = await phone();
    const shared = (await page.evaluate(() => fetch('/api/family-link').then(r => r.json()))).url;
    assert.equal(shared, `${base}/?key=${secrets.family}`);
    await linked.goto(shared); await linked.waitForSelector('.day-card');
    assert.equal(new URL(linked.url()).search, '', 'the password is gone from the address bar');
    assert.equal(await linked.locator('.tabs').count(), 0, 'the link gives the family role');
    const parentsLink = await phone();
    await parentsLink.goto(`${base}/?key=${secrets.parents}`); await parentsLink.waitForSelector('[data-form=login]');
    assert.equal(new URL(parentsLink.url()).search, '', 'the parents password never works in a link');
    await page.goto(shared); await page.waitForSelector('.tabs');
    assert.equal(await page.locator('.tabs a').count(), 5, 'a parent opening the link stays a parent');
    await page.click('a[href="#news"]'); await page.waitForSelector('#view-news');
    assert.equal(await family.evaluate(() => fetch('/api/family-link').then(r => r.status)), 403, 'the family cannot read the link');
    // Live for the family too: a second post appears without a reload.
    await page.click('[data-action=add-news]'); await page.waitForSelector('dialog[open]');
    assert.equal(await page.locator('dialog details.recent').getAttribute('open'), null, 'recent photos start folded');
    assert.match(await page.locator('dialog details.recent summary').textContent(), /Recent photos \(3\)/);
    assert.equal(await page.locator('dialog [data-attach]').first().isVisible(), false);
    await page.click('dialog details.recent summary');
    assert.equal(await page.locator('dialog [data-attach]').first().isVisible(), true, 'one tap unfolds them');
    await page.fill('dialog input[name=title_en]', 'A smile'); await page.click('dialog button[type=submit]');
    await family.waitForFunction(() => document.querySelectorAll('.entry').length === 2, null, { timeout: 5000 });
    // The same day is one section: one card, its date once, the two posts in the order they were written.
    assert.equal(await family.locator('.day-card').count(), 1, 'one card for the day, for the family');
    assert.deepEqual(await family.locator('.day-card .entry h3').allTextContents(), ['First days', 'A smile']);
    await page.waitForFunction(() => document.querySelectorAll('#view-news .entry').length === 2);
    assert.equal(await page.locator('#view-news .day-card').count(), 1, 'one card for the day, for the parents');
    await page.click('a[href="#journal"]'); await page.waitForSelector('#view-journal');
    await page.click('[data-action=add-journal]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog input[name=title]', 'Bath'); await page.click('dialog button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('#view-journal .entry').length === 2);
    assert.equal(await page.locator('#view-journal .day-card').count(), 1, 'two journal pages of one day share a card');
    assert.equal(await page.locator('#view-journal .day-card > .date').count(), 1, 'the date is written once');

    // Reactions: each phone gives an emoji once and can take it back; everyone sees the count live.
    const heart = '.entry:first-of-type .react[data-emoji="❤️"]';
    await family.click(heart);
    await family.waitForSelector(`${heart}[aria-pressed=true]`);
    assert.equal(await family.locator(`${heart} .n`).textContent(), '1');
    await linked.waitForSelector(`${heart} .n`, { timeout: 5000 });
    await linked.click(heart);
    await family.waitForFunction(sel => document.querySelector(`${sel} .n`)?.textContent === '2', heart, { timeout: 5000 });
    assert.equal(await family.locator(`${heart}`).getAttribute('aria-pressed'), 'true', 'the other phone\'s heart is not mine');
    await page.click('a[href="#news"]'); await page.waitForSelector('#view-news');
    assert.equal(await page.locator(`#view-news ${heart} .n`).textContent(), '2', 'the parents see the reactions');
    await family.click(heart);
    await family.waitForSelector(`${heart}[aria-pressed=false]`);
    assert.equal(await family.locator(`${heart} .n`).textContent(), '1', 'taken back');
    await page.waitForFunction(sel => document.querySelector(`#view-news ${sel} .n`)?.textContent === '1', heart, { timeout: 5000 });
    const firstNews = await family.evaluate(() => window.MaiaApp.news().find(p => p.title.en === 'First days').id);
    assert.equal(await family.evaluate(id => fetch('/api/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ news: id, emoji: '💩', device: 'a'.repeat(32), on: true }) }).then(r => r.status), firstNews), 400, 'only the six reactions');
    assert.equal(await page.evaluate(() => fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"reaction"}' }).then(r => r.status)), 400, 'reactions only through their own door');

    // New since the last visit: the first visit marks nothing; then the phone is up to date; a later post is new once.
    await family.reload(); await family.waitForSelector('.day-card');
    assert.match(await family.locator('.news-status').textContent(), /You are up to date/);
    assert.equal(await family.locator('.badge-new').count(), 0);
    // The family phone leaves the page in the background; the post written meanwhile waits for its return.
    const hide = p => p.evaluate(state => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state }); document.dispatchEvent(new Event('visibilitychange')); }, 'hidden');
    const show = p => p.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await hide(family);
    await page.click('[data-action=add-news]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog input[name=title_en]', 'A walk'); await page.click('dialog button[type=submit]');
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    await family.waitForFunction(() => document.querySelectorAll('.entry').length === 3, null, { timeout: 5000 });
    await show(family);
    await family.waitForSelector('.news-status.has-new', { timeout: 5000 });
    assert.match(await family.locator('.news-status').textContent(), /1 new post since your last visit/);
    assert.deepEqual(await family.locator('.entry.is-new h3').allTextContents(), ['A walk'], 'only the unseen post is marked');
    assert.equal(await family.locator('.day-card.has-new').count(), 1);
    await family.reload(); await family.waitForSelector('.day-card');
    assert.match(await family.locator('.news-status').textContent(), /You are up to date/, 'seen once, no longer new');

    // Care: an appointment shows on Today and can be ticked done.
    await page.click('a[href="#care"]'); await page.waitForSelector('#view-care');
    await page.click('[data-action=add-appointment]'); await page.waitForSelector('dialog[open]');
    await page.fill('dialog input[name=title]', 'Pediatrician, first visit with the vaccination booklet');
    await page.fill('dialog input[name=place]', 'Cabinet du Dr Dupont, 12 rue des Lilas, Paris 11e');
    await page.fill('dialog textarea[name=note]', 'Bring the carnet de santé and the mutuelle card, and ask about the vitamin D dose');
    await page.click('dialog button[type=submit]');
    await page.waitForSelector('#view-care .list li');
    const fit = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, phone: innerWidth, tabs: document.querySelector('.tabs').getBoundingClientRect().bottom <= innerHeight }));
    assert.equal(fit.page, fit.phone, 'a long appointment does not widen the page past the phone');
    assert.ok(fit.tabs, 'the tab bar stays on screen on the Care tab');
    assert.match(await page.locator('#view-care .list small').textContent(), /Dr Dupont.*vitamin D/, 'place and note are shown in full');
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
    await login(wide, secrets.parents); await wide.waitForSelector('#view-today'); await wide.waitForSelector('[data-action=push-on]');
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
  if (!process.argv.includes('--browser')) await unit();
  if (!process.argv.includes('--unit')) await browser();
})().catch(error => { console.error(error); process.exit(1); });
