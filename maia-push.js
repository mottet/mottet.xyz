'use strict';

// Reminders for Maïa's parents, by Web Push. Each phone that turns them on
// leaves a push subscription and its own choices in data/maia/push.json, next
// to the VAPID key pair made on first use. Every half minute the planner looks
// at the records and says which reminders are due; each is sent once, and the
// keys of what was sent are kept so a restart does not repeat them. A new
// journal page is pushed as it is written, to every phone but its author's.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MINUTE = 60000, HOUR = 3600000;
const LONG_FEED_MS = 40 * MINUTE;        // a feed still running after this long
const NO_FEED_MS = 2.5 * HOUR;           // quiet this long after a feed ends...
const NO_FEED_AGAIN_MS = 30 * MINUTE;    // ...then again at this interval
const NO_FEED_GIVE_UP_MS = 12 * HOUR;    // and silence after this: nobody is logging
const VITAMIN_AGAIN_MS = 3 * HOUR;       // a second nudge if the drops are still not given
const EVE_MINUTES = 19 * 60;             // the evening-before note for an appointment
const SENT_KEEP_MS = 3 * 86400000;
const TICK_MS = 30000;

const DEFAULTS = { vitamin: true, vitaminAt: '10:00', appointments: true, longFeed: true, noFeed: true, journal: true };

const shapeSettings = s => {
  const o = { ...DEFAULTS };
  if (!s || typeof s !== 'object') return o;
  for (const k of ['vitamin', 'appointments', 'longFeed', 'noFeed', 'journal']) if (typeof s[k] === 'boolean') o[k] = s[k];
  if (typeof s.vitaminAt === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.vitaminAt)) o.vitaminAt = s.vitaminAt;
  return o;
};
const shapeSubscription = s => {
  if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || !/^https:\/\/.{8,1000}$/.test(s.endpoint)) return null;
  const keys = s.keys && typeof s.keys === 'object' ? s.keys : {};
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  return { endpoint: s.endpoint, keys: { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) }, expirationTime: typeof s.expirationTime === 'number' ? s.expirationTime : null };
};

// Local time in her time zone, as the parents read it.
const partsIn = (timeZone, at) => {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = {};
  for (const { type, value } of f.formatToParts(new Date(at))) p[type] = value;
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
};
const dayBefore = day => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10); };
const hhmm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const clock = (timeZone, at) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at));
const spell = ms => { const m = Math.round(ms / MINUTE); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`; };
const side = f => (f.side === 'both' ? 'both sides' : `the ${f.side} side`);

// What is due now. Pure: records in, reminders out, nothing sent and nothing
// remembered here. `sent` holds the keys already delivered.
function plan({ records, subscriptions, now = Date.now(), sent = {}, timezone = 'Europe/Paris' }) {
  const out = [];
  const subs = subscriptions.filter(s => s.role === 'parents');
  if (!subs.length) return out;
  const live = [...records.values()].filter(r => !r.deleted);
  const local = partsIn(timezone, now);
  const due = (key, want, message) => { if (sent[key]) return; const to = subs.filter(want).map(s => s.id); if (to.length) out.push({ key, to, ...message }); };

  // Vitamin D: at each phone's chosen time, then once more three hours on.
  const given = live.some(r => r.type === 'care' && r.kind === 'vitamin' && partsIn(timezone, r.at).day === local.day);
  if (!given) for (const s of subs) {
    if (!s.settings.vitamin) continue;
    const at = hhmm(s.settings.vitaminAt);
    if (local.minutes >= at) due(`vit:${local.day}:${s.id}`, x => x.id === s.id, { title: 'Vitamin D', body: 'Her drops are not logged yet today.', url: '/#today', tag: 'vitamin' });
    if (local.minutes >= at + VITAMIN_AGAIN_MS / MINUTE) due(`vit2:${local.day}:${s.id}`, x => x.id === s.id, { title: 'Vitamin D', body: 'Still no drops logged today.', url: '/#today', tag: 'vitamin' });
  }

  // Appointments: the evening before at seven, and an hour before.
  for (const a of live) {
    if (a.type !== 'appointment' || a.done || !a.at) continue;
    const at = Date.parse(a.at);
    if (Number.isNaN(at) || at < now - 30 * MINUTE) continue;
    const where = a.place ? ` at ${a.place}` : '';
    if (now >= at - HOUR) due(`appt:${a.id}:1h:${a.at}`, s => s.settings.appointments, { title: 'In an hour', body: `${a.title}${where}, ${clock(timezone, at)}.`, url: '/#care', tag: `appt-${a.id}` });
    const apptDay = partsIn(timezone, at).day;
    if (local.day === dayBefore(apptDay) && local.minutes >= EVE_MINUTES) due(`appt:${a.id}:eve:${a.at}`, s => s.settings.appointments, { title: 'Tomorrow', body: `${a.title}${where}, ${clock(timezone, at)}.`, url: '/#care', tag: `appt-${a.id}` });
  }

  // Feeds: one still running after forty minutes; none for two and a half hours, then every thirty minutes.
  const feeds = live.filter(r => r.type === 'feed');
  const running = feeds.filter(f => !f.end).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (running) {
    const ms = now - Date.parse(running.start);
    if (ms >= LONG_FEED_MS) due(`long:${running.id}`, s => s.settings.longFeed, { title: 'Still feeding?', body: `On ${side(running)} since ${clock(timezone, running.start)}, ${spell(ms)} ago.`, url: '/#today', tag: 'feed' });
  } else {
    const last = feeds.filter(f => f.end).sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0];
    if (last) {
      const gap = now - Date.parse(last.end);
      if (gap >= NO_FEED_MS && gap < NO_FEED_GIVE_UP_MS) {
        const n = Math.floor((gap - NO_FEED_MS) / NO_FEED_AGAIN_MS);
        due(`nofeed:${last.id}:${n}`, s => s.settings.noFeed, { title: 'No feed for a while', body: `Last one ended ${spell(gap)} ago, ${side(last)} at ${clock(timezone, last.end)}.`, url: '/#today', tag: 'feed' });
      }
    }
  }
  return out;
}

const journalMessage = rec => ({ title: 'A page in the journal', body: rec.title || (rec.text || '').replace(/\s+/g, ' ').slice(0, 120) || 'A new page, with photos.', url: '/#journal', tag: `journal-${rec.id}` });

module.exports = function createPush({ dir, store, timezone = 'Europe/Paris', send, log = () => {} }) {
  const file = path.join(dir, 'push.json');
  let data = { keys: null, subscriptions: [], sent: {} };
  try { data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') log(`push.json unreadable: ${error.message}`); }
  let webpush = null;
  const library = () => { if (!webpush) webpush = require('web-push'); return webpush; };
  const write = () => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  const keys = () => {
    if (!data.keys) { data.keys = library().generateVAPIDKeys(); write(); }
    return data.keys;
  };
  const deliver = send || (async (sub, message) => {
    const k = keys();
    await library().sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(message), { TTL: 3600, vapidDetails: { subject: 'https://maia.mottet.xyz', publicKey: k.publicKey, privateKey: k.privateKey } });
  });

  const find = endpoint => data.subscriptions.find(s => s.endpoint === endpoint) || null;
  const subscribe = (role, subscription, settings) => {
    const shaped = shapeSubscription(subscription);
    if (!shaped) return null;
    let sub = find(shaped.endpoint);
    if (!sub) { sub = { id: crypto.randomBytes(6).toString('hex'), created: new Date().toISOString() }; data.subscriptions.push(sub); }
    Object.assign(sub, shaped, { role, settings: shapeSettings({ ...(sub.settings || {}), ...(settings || {}) }), seen: new Date().toISOString() });
    write();
    return sub;
  };
  const unsubscribe = endpoint => { const before = data.subscriptions.length; data.subscriptions = data.subscriptions.filter(s => s.endpoint !== endpoint); if (data.subscriptions.length !== before) write(); return before !== data.subscriptions.length; };

  let sending = Promise.resolve();
  const sendTo = (ids, message) => {
    const targets = data.subscriptions.filter(s => ids.includes(s.id));
    sending = sending.then(() => Promise.all(targets.map(async sub => {
      try { await deliver(sub, message); } catch (error) {
        if (error && (error.statusCode === 404 || error.statusCode === 410)) { unsubscribe(sub.endpoint); log(`push: a phone is gone (${error.statusCode})`); } else log(`push failed: ${error.message || error}`);
      }
    }))).catch(() => {});
    return sending;
  };

  // The journal: told as it is written, to every phone but the writer's.
  const journal = (rec, authorId) => {
    const to = data.subscriptions.filter(s => s.role === 'parents' && s.settings.journal && s.id !== authorId).map(s => s.id);
    return to.length ? sendTo(to, journalMessage(rec)) : Promise.resolve();
  };

  const tick = (now = Date.now()) => {
    const due = plan({ records: store.records, subscriptions: data.subscriptions, now, sent: data.sent, timezone });
    let changed = false;
    for (const key of Object.keys(data.sent)) if (now - data.sent[key] > SENT_KEEP_MS) { delete data.sent[key]; changed = true; }
    for (const r of due) { data.sent[r.key] = now; changed = true; sendTo(r.to, { title: r.title, body: r.body, url: r.url, tag: r.tag }); }
    if (changed) write();
    return due;
  };
  let timer = null;
  const start = () => { if (!timer) { timer = setInterval(() => { try { tick(); } catch (error) { log(`push tick failed: ${error.message}`); } }, TICK_MS); timer.unref(); } };
  const stop = () => { clearInterval(timer); timer = null; };

  return { publicKey: () => keys().publicKey, find, subscribe, unsubscribe, journal, tick, start, stop, get subscriptions() { return data.subscriptions; }, get sent() { return data.sent; }, flush: () => sending };
};

module.exports.plan = plan;
module.exports.DEFAULTS = DEFAULTS;
module.exports.shapeSettings = shapeSettings;
module.exports.journalMessage = journalMessage;
