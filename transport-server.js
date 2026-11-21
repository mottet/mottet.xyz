'use strict';

// Next passages for the Garmin watch app in transport-watch/: the watch asks
// /api/transport/next?ref=<MonitoringRef>&line=<LineRef> and gets back the
// next few departures in a few hundred bytes. It cannot ask Île-de-France
// Mobilités' PRIM API itself: PRIM's stop-monitoring answer for an RER
// station holds three hours of trains (about 50 kB), more than Connect IQ
// takes, and PRIM has no parameter to cut it down. So the server asks, keeps
// the next departures and drops the rest.
//
// .transport-secrets.json beside server.js (gitignored) holds the PRIM API
// key and the watch's token, read on every request so both change without a
// restart:
//   { "primKey": "...", "watch": "<24 characters or more>" }
// Answers are cached 20 seconds per stop, so the watches never cost more than
// three PRIM calls a minute per stop, whatever their number.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRIM_URL = 'https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring';
const REF = /^STIF:(StopArea:SP|StopPoint:Q):[0-9]{1,8}:$/;
const LINE = /^STIF:Line::C[0-9]{5}:$/;
const MAX_DEPARTURES = 8;
const CACHE_MS = 20 * 1000;
const TRIES = 10, TRIES_WINDOW_MS = 15 * 60 * 1000;

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function readSecrets(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (s && typeof s === 'object') return s;
  } catch { /* missing or malformed: the endpoint answers 503 */ }
  return null;
}

// SIRI text fields come as "x", {"value":"x"} or [{"value":"x"}].
function text(v) {
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === 'object') v = v.value;
  return typeof v === 'string' && v ? v : null;
}

// A SIRI Lite stop-monitoring answer -> the next departures, soonest first:
// [{ t: Unix seconds, d: destination, c: 1 if cancelled, a: 1 if at the platform }].
// A departure more than 30 seconds gone is dropped.
function departures(siri, now = Date.now()) {
  const deliveries = siri && siri.Siri && siri.Siri.ServiceDelivery && siri.Siri.ServiceDelivery.StopMonitoringDelivery;
  const visits = Array.isArray(deliveries) && deliveries[0] && Array.isArray(deliveries[0].MonitoredStopVisit) ? deliveries[0].MonitoredStopVisit : [];
  const out = [];
  for (const visit of visits) {
    const mvj = visit && visit.MonitoredVehicleJourney;
    const call = mvj && mvj.MonitoredCall;
    if (!call) continue;
    const when = call.ExpectedDepartureTime || call.ExpectedArrivalTime || call.AimedDepartureTime || call.AimedArrivalTime;
    const ms = Date.parse(when);
    if (!Number.isFinite(ms) || ms < now - 30 * 1000) continue;
    const dep = { t: Math.round(ms / 1000), d: text(call.DestinationDisplay) || text(mvj.DestinationName) || text(mvj.DirectionName) || '?' };
    if (String(call.DepartureStatus || call.ArrivalStatus || '').toLowerCase() === 'cancelled') dep.c = 1;
    if (call.VehicleAtStop === true) dep.a = 1;
    out.push(dep);
  }
  out.sort((x, y) => x.t - y.t);
  return out.slice(0, MAX_DEPARTURES);
}

module.exports = function transport(options = {}) {
  const secretsFile = options.secrets || process.env.TRANSPORT_SECRETS || path.join(__dirname, '.transport-secrets.json');
  const primUrl = options.primUrl || process.env.TRANSPORT_PRIM_URL || PRIM_URL;
  const router = express.Router();
  const cache = new Map();      // `${ref}|${line}` -> { at, body } or { at, pending }
  const failures = new Map();   // address -> times of wrong tokens

  // The watch sends the `watch` token as a Bearer header, as Maïa's does.
  const watchOk = (req, res, secrets) => {
    const token = secrets && typeof secrets.watch === 'string' && secrets.watch.length >= 24 ? secrets.watch : '';
    if (!token || !secrets.primKey) { res.status(503).json({ ok: false, message: 'Off on this server: write .transport-secrets.json beside server.js with "primKey" and "watch" (24 characters or more).' }); return false; }
    const address = req.ip, now = Date.now();
    const recent = (failures.get(address) || []).filter(t => now - t < TRIES_WINDOW_MS);
    if (recent.length >= TRIES) { res.status(429).json({ ok: false, message: 'Too many tries. Wait a quarter of an hour.' }); return false; }
    const [kind, given] = (req.get('authorization') || '').split(' ');
    if (kind === 'Bearer' && given && same(given, token)) return true;
    failures.set(address, recent.concat(now));
    res.status(401).json({ ok: false, message: 'wrong' });
    return false;
  };

  async function ask(ref, line, primKey) {
    const url = new URL(primUrl);
    url.searchParams.set('MonitoringRef', ref);
    if (line) url.searchParams.set('LineRef', line);
    const res = await fetch(url, { headers: { apikey: primKey, accept: 'application/json' }, signal: AbortSignal.timeout(10 * 1000) });
    if (!res.ok) { const e = new Error(`PRIM answered ${res.status}`); e.status = res.status; throw e; }
    return { ok: true, deps: departures(await res.json()) };
  }

  router.get('/next', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const secrets = readSecrets(secretsFile);
    if (!watchOk(req, res, secrets)) return;
    const ref = String(req.query.ref || ''), line = String(req.query.line || '');
    if (!REF.test(ref) || (line && !LINE.test(line))) return res.status(400).json({ ok: false, message: 'ref must look like STIF:StopArea:SP:43234: and line like STIF:Line::C01742:' });

    const key = `${ref}|${line}`;
    let entry = cache.get(key);
    if (!entry || Date.now() - entry.at > CACHE_MS) {
      entry = { at: Date.now(), pending: ask(ref, line, secrets.primKey) };
      cache.set(key, entry);
      if (cache.size > 200) cache.delete(cache.keys().next().value);
    }
    try {
      const body = await entry.pending;
      // Re-drop the departures gone since the answer was cached.
      const now = Date.now();
      res.json({ ...body, deps: body.deps.filter(d => d.t * 1000 >= now - 30 * 1000) });
    } catch (error) {
      if (cache.get(key) === entry) cache.delete(key);   // do not keep a failure
      res.status(error.status === 429 ? 429 : 502).json({ ok: false, message: error.message });
    }
  });

  return { router, readSecrets: () => readSecrets(secretsFile) };
};

module.exports.departures = departures;
module.exports.text = text;
