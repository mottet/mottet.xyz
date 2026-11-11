'use strict';

// Maïa's site at maia.mottet.xyz: a journal, a feeding log and care notes for
// her parents, and news for the family. It lives in the same process as the
// house and is mounted only for its own host names, so nothing of it answers
// on mottet.xyz. Records are one JSON line each in data/maia/records.jsonl
// (the latest line per id wins, `deleted: true` hides one), photos are files
// beside it, and two passwords in .maia-secrets.json give the two roles.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const createPush = require('./maia-push.js');

const FACTS = { born: '2026-11-04T20:44:00+01:00', weight: 3500, height: 49, timezone: 'Europe/Paris' };
const HOSTS = new Set(['maia.mottet.xyz', 'maia.localhost'].concat((process.env.MAIA_HOSTS || '').split(',').filter(Boolean)));
const ROLES = ['parents', 'family'];
const TYPES = ['feed', 'care', 'appointment', 'journal', 'news', 'photo', 'reaction'];
// The reactions a news post can get. A phone gives each at most once.
const EMOJI = ['❤️', '🥰', '😂', '🥹', '👏', '🎉'];
const COOKIE = 'maia';
const COOKIE_DAYS = 365;
const ID = /^[a-z0-9]{8,32}$/;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const LOGIN_TRIES = 10; // failures per address before a quarter hour's wait
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const newId = () => crypto.randomBytes(8).toString('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sign = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('base64url');

// The family sees news, the photos attached to it and the reactions to it, nothing else.
const forFamily = rec => rec.type === 'news' || rec.type === 'reaction' || (rec.type === 'photo' && rec.audience === 'family');
// A phone is known by a random id it keeps; records only carry a keyed hash of
// it, so nobody reading the reactions can act as another phone.
const DEVICE = /^[a-f0-9]{16,64}$/;
const hashOf = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');
const whoOf = (secrets, device) => hashOf(secrets.cookieSecret, `who|${device}`).slice(0, 16);

function openStore(dir) {
  const file = path.join(dir, 'records.jsonl');
  const photos = path.join(dir, 'photos');
  const records = new Map();
  let rev = 0;
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch { continue; } // a torn last line is skipped, never fatal
      if (rec && ID.test(rec.id || '')) { records.set(rec.id, rec); rev = Math.max(rev, rec.rev || 0); }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const ready = () => { fs.mkdirSync(photos, { recursive: true }); };
  const put = rec => {
    ready();
    rec.rev = ++rev;
    fs.appendFileSync(file, JSON.stringify(rec) + '\n');
    records.set(rec.id, rec);
    return rec;
  };
  const visible = role => {
    const out = [];
    for (const rec of records.values()) if (!rec.deleted && (role === 'parents' || forFamily(rec))) out.push(rec);
    return out.sort((a, b) => a.rev - b.rev);
  };
  return { dir, file, photos, records, put, visible, get rev() { return rev; } };
}

// Secrets are read on each use, like the glyphs token, so they can be set or
// changed without a restart.
function readSecrets(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (ROLES.every(r => typeof s[r] === 'string' && s[r].length >= 8) && typeof s.cookieSecret === 'string' && s.cookieSecret.length >= 16) return s;
  } catch { /* missing or malformed: saving and logging in are off */ }
  return null;
}

function cookieOf(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return '';
}
function roleOf(req, secrets) {
  if (!secrets) return null;
  const [role, expires, sig] = cookieOf(req).split('.');
  if (!ROLES.includes(role) || !/^\d+$/.test(expires || '') || !sig) return null;
  if (Number(expires) < Date.now()) return null;
  return same(sign(secrets.cookieSecret, `${role}.${expires}`), sig) ? role : null;
}
function cookieFor(role, secrets, secure) {
  const expires = Date.now() + COOKIE_DAYS * 86400000;
  const value = `${role}.${expires}.${sign(secrets.cookieSecret, `${role}.${expires}`)}`;
  return `${COOKIE}=${value}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
const clearCookie = secure => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const text3 = (v, max) => { const o = {}; for (const l of ['fr', 'en', 'zh']) if (v && typeof v[l] === 'string') o[l] = v[l].slice(0, max); return o; };
const iso = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v))) ? new Date(v).toISOString() : null;
const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const ids = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && ID.test(x)).slice(0, 12) : [];

// What each type keeps of a record the phone sends. Anything else is dropped.
const SHAPES = {
  feed: r => ({ side: ['left', 'right', 'both'].includes(r.side) ? r.side : 'left', start: iso(r.start) || new Date().toISOString(), end: iso(r.end), note: str(r.note, 500), pauses: Array.isArray(r.pauses) ? r.pauses.slice(0, 30).map(p => ({ start: iso(p && p.start), end: iso(p && p.end) })).filter(p => p.start) : [] }),
  care: r => ({ kind: r.kind === 'medicine' ? 'medicine' : 'vitamin', name: str(r.name, 80) || 'Vitamin D', dose: str(r.dose, 80), at: iso(r.at) || new Date().toISOString(), note: str(r.note, 500) }),
  appointment: r => ({ title: str(r.title, 120), at: iso(r.at), place: str(r.place, 120), note: str(r.note, 1000), done: Boolean(r.done) }),
  journal: r => ({ on: day(r.on) || new Date().toISOString().slice(0, 10), title: str(r.title, 120), text: str(r.text, 8000), photos: ids(r.photos), weight: num(r.weight), height: num(r.height), head: num(r.head) }),
  news: r => ({ on: day(r.on) || new Date().toISOString().slice(0, 10), title: text3(r.title, 120), text: text3(r.text, 8000), photos: ids(r.photos) }),
  photo: r => ({ audience: r.audience === 'family' ? 'family' : 'parents' }),
};

module.exports = function maia(options = {}) {
  // MAIA_DATA and MAIA_SECRETS let a check run against a folder of its own.
  const dir = options.dir || process.env.MAIA_DATA || path.join(__dirname, 'data', 'maia');
  const secretsFile = options.secrets || process.env.MAIA_SECRETS || path.join(__dirname, '.maia-secrets.json');
  const site = options.site || path.join(__dirname, 'maia');
  const fonts = options.fonts || path.join(__dirname, 'public', 'assets', 'fonts');
  const store = openStore(dir);
  // Reminders by Web Push; a check passes its own `send` to catch what goes out.
  // Reminders go out only from the systemd service (which sets INVOCATION_ID), from a
  // check that catches them itself, or when MAIA_PUSH=on says so: never from a spare server.
  const live = Boolean(options.send || process.env.INVOCATION_ID || process.env.MAIA_PUSH === 'on') && process.env.MAIA_PUSH !== 'off';
  const push = createPush({ dir, store, timezone: FACTS.timezone, send: options.send, live, log: options.log || (m => console.error(`[maia] ${m}`)) });
  const router = express.Router();
  const failures = new Map(); // address -> [timestamps]
  let nsp = null;

  const isHost = req => HOSTS.has(req.hostname);
  const secure = req => req.secure || req.get('x-forwarded-proto') === 'https';
  const off = res => res.status(503).json({ ok: false, message: 'Logging in is off on this server: write a .maia-secrets.json beside server.js with "parents", "family" and "cookieSecret".' });

  router.use((req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    req.secrets = readSecrets(secretsFile);
    req.role = roleOf(req, req.secrets);
    next();
  });
  router.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

  // The gate.
  router.post('/api/login', express.json({ limit: '2kb' }), (req, res) => {
    if (!req.secrets) return off(res);
    const address = req.ip;
    const now = Date.now();
    const recent = (failures.get(address) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    if (recent.length >= LOGIN_TRIES) return res.status(429).json({ ok: false, message: 'Too many tries. Wait a quarter of an hour.' });
    const password = str(req.body && req.body.password, 200);
    const role = ROLES.find(r => password && same(password, req.secrets[r]));
    if (!role) { failures.set(address, recent.concat(now)); return res.status(401).json({ ok: false, message: 'wrong' }); }
    failures.delete(address);
    res.set('Set-Cookie', cookieFor(role, req.secrets, secure(req)));
    res.json({ ok: true, role });
  });
  // A link to share with the family: /?key=<family password> lets the reader in
  // as family, then sends them on to / so the password leaves the address bar.
  // Only the family password works this way, and a parent who opens the link
  // stays a parent. A wrong key counts as a failed try and lands on the gate.
  router.get('/', (req, res, next) => {
    if (typeof req.query.key !== 'string') return next();
    res.set('Cache-Control', 'no-store');
    if (!req.secrets || req.role === 'parents') return res.redirect(303, '/');
    const address = req.ip, now = Date.now();
    const recent = (failures.get(address) || []).filter(t => now - t < LOGIN_WINDOW_MS);
    const key = str(req.query.key, 200);
    if (recent.length < LOGIN_TRIES && key && same(key, req.secrets.family)) {
      failures.delete(address);
      res.set('Set-Cookie', cookieFor('family', req.secrets, secure(req)));
    } else if (recent.length < LOGIN_TRIES) failures.set(address, recent.concat(now));
    res.redirect(303, '/');
  });
  // The parents copy that link from the News tab.
  router.get('/api/family-link', (req, res) => {
    if (!needParents(req, res)) return;
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, url: `${secure(req) ? 'https' : 'http'}://${req.get('host')}/?key=${encodeURIComponent(req.secrets.family)}` });
  });
  router.post('/api/logout', (req, res) => { res.set('Set-Cookie', clearCookie(secure(req))); res.json({ ok: true }); });
  router.get('/api/me', (req, res) => {
    if (!req.secrets) return off(res);
    res.json({ ok: true, role: req.role, facts: FACTS });
  });

  const needRole = (req, res) => { if (req.role) return true; res.status(401).json({ ok: false, message: 'Log in first.' }); return false; };
  const needParents = (req, res) => { if (req.role === 'parents') return true; res.status(req.role ? 403 : 401).json({ ok: false, message: 'Only the parents write here.' }); return false; };

  // Records: everything visible to the role, and writes from the parents.
  router.get('/api/records', (req, res) => {
    if (!needRole(req, res)) return;
    res.set('Cache-Control', 'no-store');
    const device = str(req.get('x-maia-device'), 64);
    res.json({ ok: true, rev: store.rev, records: store.visible(req.role), me: DEVICE.test(device) ? whoOf(req.secrets, device) : null });
  });

  // Reactions: anyone let in may give or take back an emoji on a news post.
  router.post('/api/react', express.json({ limit: '2kb' }), (req, res) => {
    if (!needRole(req, res)) return;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const post = store.records.get(str(body.news, 32));
    const device = str(body.device, 64);
    if (!post || post.type !== 'news' || post.deleted) return res.status(404).json({ ok: false, message: 'That news is gone.' });
    if (!EMOJI.includes(body.emoji)) return res.status(400).json({ ok: false, message: 'Not one of the reactions.' });
    if (!DEVICE.test(device)) return res.status(400).json({ ok: false, message: 'Bad device.' });
    const id = hashOf(req.secrets.cookieSecret, `reaction|${post.id}|${device}|${body.emoji}`).slice(0, 24);
    const existing = store.records.get(id);
    const on = Boolean(body.on);
    if (existing && Boolean(!existing.deleted) === on) return res.json({ ok: true, record: existing });
    const rec = store.put({ id, type: 'reaction', news: post.id, emoji: body.emoji, who: whoOf(req.secrets, device), by: req.role, at: new Date().toISOString(), ...(on ? {} : { deleted: true }) });
    broadcast(rec);
    res.json({ ok: true, record: rec });
  });
  router.post('/api/records', express.json({ limit: '64kb' }), (req, res) => {
    if (!needParents(req, res)) return;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = typeof body.id === 'string' ? body.id : newId();
    if (!ID.test(id)) return res.status(400).json({ ok: false, message: 'Bad id.' });
    const existing = store.records.get(id);
    const type = existing ? existing.type : body.type;
    if (!TYPES.includes(type) || type === 'photo' || type === 'reaction') return res.status(400).json({ ok: false, message: 'Bad type.' });
    const rec = body.deleted
      ? { id, type, deleted: true, at: new Date().toISOString(), by: req.role }
      : { id, type, at: existing ? existing.at : new Date().toISOString(), by: req.role, ...SHAPES[type](body) };
    store.put(rec);
    if (type === 'journal' && !existing) push.journal(rec, str(req.get('x-maia-push'), 32));
    // Photos that go into news become visible to the family.
    if (type === 'news' && !rec.deleted) for (const pid of rec.photos) {
      const photo = store.records.get(pid);
      if (photo && photo.type === 'photo' && photo.audience !== 'family') broadcast(store.put({ ...photo, audience: 'family' }));
    }
    broadcast(rec);
    res.json({ ok: true, record: rec });
  });

  // Reminders: each parents' phone leaves its subscription and its choices.
  router.post('/api/push/state', express.json({ limit: '4kb' }), (req, res) => {
    if (!needParents(req, res)) return;
    const sub = typeof req.body.endpoint === 'string' ? push.find(req.body.endpoint) : null;
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, key: push.publicKey(), id: sub ? sub.id : null, settings: sub ? sub.settings : null, defaults: createPush.DEFAULTS });
  });
  router.post('/api/push/subscribe', express.json({ limit: '8kb' }), (req, res) => {
    if (!needParents(req, res)) return;
    const sub = push.subscribe(req.role, req.body.subscription, req.body.settings);
    if (!sub) return res.status(400).json({ ok: false, message: 'That is not a push subscription.' });
    res.json({ ok: true, id: sub.id, settings: sub.settings });
  });
  router.post('/api/push/unsubscribe', express.json({ limit: '4kb' }), (req, res) => {
    if (!needParents(req, res)) return;
    res.json({ ok: true, gone: typeof req.body.endpoint === 'string' && push.unsubscribe(req.body.endpoint) });
  });

  // Photos: the phone resizes before sending; the server keeps the bytes as they come.
  router.post('/api/photos', express.raw({ type: Object.keys(IMAGE_TYPES), limit: '8mb' }), (req, res) => {
    if (!needParents(req, res)) return;
    const ext = IMAGE_TYPES[(req.get('content-type') || '').split(';')[0].trim()];
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ ok: false, message: 'Send a JPEG, PNG or WebP body.' });
    const id = newId();
    let rec;
    try {
      fs.mkdirSync(store.photos, { recursive: true });
      fs.writeFileSync(path.join(store.photos, `${id}.${ext}`), req.body);
      rec = store.put({ id, type: 'photo', at: new Date().toISOString(), by: req.role, ext, w: num(Number(req.query.w)), h: num(Number(req.query.h)), bytes: req.body.length, ...SHAPES.photo(req.query) });
    } catch (error) { return res.status(500).json({ ok: false, message: `Could not keep the photo: ${error.message}` }); }
    broadcast(rec);
    res.json({ ok: true, record: rec });
  });
  router.get('/photos/:id', (req, res) => {
    if (!needRole(req, res)) return;
    const rec = store.records.get(req.params.id);
    if (!rec || rec.type !== 'photo' || rec.deleted || (req.role !== 'parents' && !forFamily(rec))) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(path.join(store.photos, `${rec.id}.${rec.ext}`));
  });

  // The site itself. The page is never cached; tagged css and js may be.
  router.use('/assets/fonts', express.static(fonts, { immutable: true, maxAge: '1y' }));
  router.use(express.static(site, { index: 'index.html', setHeaders: (res, file) => { if (file.endsWith('.html') || file.endsWith('.webmanifest') || file.endsWith('sw.js')) res.set('Cache-Control', 'no-cache'); } }));
  router.use((req, res) => res.status(404).type('text/plain').send('Not here.'));

  function broadcast(rec) {
    if (!nsp) return;
    nsp.to('parents').emit('maia:record', rec);
    if (forFamily(rec)) nsp.to('family').emit('maia:record', rec);
  }
  // Live updates between the two phones, on the socket.io namespace /maia.
  function attach(io) {
    nsp = io.of('/maia');
    nsp.use((socket, next) => {
      const role = roleOf(socket.request, readSecrets(secretsFile));
      if (!role) return next(new Error('unauthorized'));
      socket.data.role = role;
      next();
    });
    nsp.on('connection', socket => { socket.join(socket.data.role); });
    push.start();
    return nsp;
  }

  const middleware = (req, res, next) => (isHost(req) ? router(req, res, next) : next());
  return { middleware, router, attach, store, push, isHost, FACTS, HOSTS, readSecrets: () => readSecrets(secretsFile), roleOf: req => roleOf(req, readSecrets(secretsFile)), cookieFor: role => cookieFor(role, readSecrets(secretsFile), true) };
};

module.exports.FACTS = FACTS;
module.exports.openStore = openStore;
module.exports.forFamily = forFamily;
module.exports.SHAPES = SHAPES;
module.exports.sign = sign;
module.exports.EMOJI = EMOJI;
