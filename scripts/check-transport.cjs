'use strict';

// The transport relay's checks (transport-server.js), in Node alone: the
// SIRI answer cut down to the next departures, then the endpoint on a spare
// port against a fake PRIM: the token, the refs it accepts, the cache, and
// PRIM's failures passed on.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const Transport = require('../transport-server.js');

const iso = ms => new Date(ms).toISOString();
const visit = (dest, ms, extra = {}) => ({ MonitoredVehicleJourney: { DestinationName: [{ value: dest }], MonitoredCall: { ExpectedDepartureTime: iso(ms), ...extra } } });
const siri = visits => ({ Siri: { ServiceDelivery: { StopMonitoringDelivery: [{ MonitoredStopVisit: visits }] } } });

function unit() {
  const now = Date.parse('2026-11-21T10:00:00Z');
  const deps = Transport.departures(siri([
    visit('Boissy-Saint-Léger', now + 9 * 60e3),
    visit('Saint-Germain-en-Laye', now + 3 * 60e3, { DestinationDisplay: [{ value: 'St-Germain' }] }),
    visit('Poissy', now + 5 * 60e3, { DepartureStatus: 'cancelled' }),
    visit('Cergy-le-Haut', now - 2 * 60e3),                       // gone
    visit('Boissy-Saint-Léger', now + 10e3, { VehicleAtStop: true }),
    { MonitoredVehicleJourney: { MonitoredCall: {} } },           // no time
  ]), now);
  assert.deepEqual(deps, [
    { t: now / 1000 + 10, d: 'Boissy-Saint-Léger', a: 1 },
    { t: now / 1000 + 180, d: 'St-Germain' },
    { t: now / 1000 + 300, d: 'Poissy', c: 1 },
    { t: now / 1000 + 540, d: 'Boissy-Saint-Léger' },
  ], 'soonest first, the display name first, gone and timeless ones dropped');
  assert.equal(Transport.departures(siri(Array.from({ length: 30 }, (_, i) => visit('X', now + i * 60e3))), now).length, 8, 'eight at most');
  assert.deepEqual(Transport.departures({}), []);
  assert.deepEqual(Transport.departures({ Siri: { ServiceDelivery: { StopMonitoringDelivery: [] } } }), []);
  assert.equal(Transport.text('a'), 'a');
  assert.equal(Transport.text([]), null);
  console.log('unit: ok');
}

const listen = app => new Promise(resolve => { const s = http.createServer(app).listen(0, '127.0.0.1', () => resolve(s)); });

async function endpoint() {
  // A fake PRIM that counts its calls and can be told to fail.
  let calls = 0, failWith = 0, lastQuery = null, lastKey = null;
  const prim = express();
  prim.get('/stop-monitoring', (req, res) => {
    calls++; lastQuery = req.query; lastKey = req.get('apikey');
    if (failWith) return res.status(failWith).json({});
    res.json(siri([visit('Boissy-Saint-Léger', Date.now() + 4 * 60e3)]));
  });
  const primServer = await listen(prim);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transport-check-'));
  const secrets = path.join(dir, 'secrets.json');
  const token = 'w'.repeat(24);
  const t = Transport({ secrets, primUrl: `http://127.0.0.1:${primServer.address().port}/stop-monitoring` });
  const app = express();
  app.use('/api/transport', t.router);
  const server = await listen(app);
  const base = `http://127.0.0.1:${server.address().port}/api/transport/next`;
  const get = (query, auth = `Bearer ${token}`) => fetch(`${base}?${new URLSearchParams(query)}`, { headers: auth ? { authorization: auth } : {} });
  const rer = { ref: 'STIF:StopArea:SP:43234:', line: 'STIF:Line::C01742:' };

  try {
    assert.equal((await get(rer)).status, 503, 'off without a secrets file');
    fs.writeFileSync(secrets, JSON.stringify({ primKey: 'prim-test-key', watch: token }));

    assert.equal((await get(rer, '')).status, 401, 'no token');
    assert.equal((await get(rer, 'Bearer nope')).status, 401, 'wrong token');
    assert.equal((await get({ ref: 'https://evil.example/' })).status, 400, 'only STIF refs');
    assert.equal((await get({ ref: rer.ref, line: 'C01742' })).status, 400, 'only STIF lines');
    assert.equal(calls, 0, 'nothing reached PRIM yet');

    let res = await get(rer);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.deps.length, 1);
    assert.equal(body.deps[0].d, 'Boissy-Saint-Léger');
    assert.equal(lastKey, 'prim-test-key', 'the key goes to PRIM as the apikey header');
    assert.deepEqual(lastQuery, { MonitoringRef: rer.ref, LineRef: rer.line });

    await get(rer);
    assert.equal(calls, 1, 'the second ask within 20 s comes from the cache');
    await get({ ref: 'STIF:StopArea:SP:58258:' });
    assert.equal(calls, 2, 'another stop asks PRIM');
    assert.equal(lastQuery.LineRef, undefined, 'no line, no LineRef');

    failWith = 429;
    res = await get({ ref: 'STIF:StopArea:SP:1:' });
    assert.equal(res.status, 429, "PRIM's quota passed on");
    failWith = 401;
    res = await get({ ref: 'STIF:StopArea:SP:2:' });
    assert.equal(res.status, 502, "a wrong PRIM key is the server's fault, not the watch's");
    failWith = 0;
    res = await get({ ref: 'STIF:StopArea:SP:2:' });
    assert.equal(res.status, 200, 'a failure is not cached');

    // Ten wrong tokens and the address waits.
    for (let i = 0; i < 8; i++) await get(rer, 'Bearer nope');
    assert.equal((await get(rer)).status, 429, 'too many wrong tokens');
    console.log('endpoint: ok');
  } finally {
    server.close(); primServer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  unit();
  await endpoint();
})().catch(error => { console.error(error); process.exit(1); });
