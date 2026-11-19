'use strict';

// Maïa's site. One page: a gate, then the parents' tools (Today, Feeds,
// Journal, Care, News) or the family's news, by the role the cookie holds.
// Records come from /api/records and arrive live on the /maia socket; every
// write goes through save(), which the server validates and broadcasts.
(function () {
  const I = window.MaiaI18n, A = window.MaiaArt;
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

  const state = { role: null, facts: null, records: new Map(), lang: store.get('maia-lang') || I.guess(), gateError: '', socket: null, ticker: null, me: null, seenBefore: undefined };
  // This phone's own random id, so its reactions can be told apart and taken back.
  const device = (() => { let d = store.get('maia-device'); if (!/^[a-f0-9]{32}$/.test(d || '')) { d = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); store.set('maia-device', d); } return d; })();
  const EMOJI = ['❤️', '🥰', '😂', '🥹', '👏', '🎉'];
  const VIEWS = ['today', 'feeds', 'journal', 'care', 'news'];
  const view = () => { const h = location.hash.replace('#', ''); return VIEWS.includes(h) ? h : 'today'; };

  // ---- time -------------------------------------------------------------
  const pad = n => String(n).padStart(2, '0');
  const localDay = d => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const today = () => localDay(new Date());
  const fmtTime = d => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
  const fmtDay = day => { const [y, m, d] = day.split('-').map(Number); const date = new Date(y, m - 1, d); const label = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date); return day === today() ? `Today, ${label}` : day === localDay(Date.now() - 86400000) ? `Yesterday, ${label}` : label; };
  const fmtDateTime = d => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
  const minutes = ms => Math.max(0, Math.round(ms / 60000));
  const duration = ms => { const m = minutes(ms); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
  const elapsed = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`; };
  const ago = d => { const m = minutes(Date.now() - new Date(d)); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60); return h < 24 ? `${h} h ${pad(m % 60)} ago` : `${Math.floor(h / 24)} d ${h % 24} h ago`; };
  const toInput = d => { d = new Date(d); return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromInput = s => s ? new Date(s).toISOString() : null;

  // ---- records ------------------------------------------------------------
  const all = type => [...state.records.values()].filter(r => r.type === type && !r.deleted);
  const feeds = () => all('feed').sort((a, b) => new Date(b.start) - new Date(a.start));
  const running = () => feeds().find(f => !f.end) || null;
  const lastDone = () => feeds().find(f => f.end) || null;
  // A feed can be paused (a burp, a change): pauses are {start, end} on the feed,
  // the last one open while she rests, and no duration counts them.
  const pausesOf = f => (Array.isArray(f.pauses) ? f.pauses : []);
  const isPaused = f => !f.end && pausesOf(f).some(p => !p.end);
  const pausedIn = (f, x, y) => pausesOf(f).reduce((s, p) => s + Math.max(0, Math.min(y, p.end ? Date.parse(p.end) : (f.end ? Date.parse(f.end) : Date.now())) - Math.max(x, Date.parse(p.start))), 0);
  const activeIn = (f, x, y) => { const a = Math.max(x, Date.parse(f.start)), b = Math.min(y, f.end ? Date.parse(f.end) : Date.now()); return b > a ? (b - a) - pausedIn(f, a, b) : 0; };
  const feedMs = f => activeIn(f, -Infinity, Infinity);
  // The stretches of a feed when she was really at the breast: start to end, pauses cut out.
  const activeSpans = f => {
    const end = f.end ? Date.parse(f.end) : Date.now();
    const cuts = pausesOf(f).map(p => [Date.parse(p.start), p.end ? Date.parse(p.end) : end]).sort((x, y) => x[0] - y[0]);
    const out = []; let at = Date.parse(f.start);
    for (const [ps, pe] of cuts) { if (ps > at) out.push([at, Math.min(ps, end)]); at = Math.max(at, pe); }
    if (end > at) out.push([at, end]);
    return out.filter(([a, b]) => b > a);
  };
  // Switching side keeps the same feed: each switch is {at, to}, and `side` is the side she is on now.
  const switchesOf = f => (Array.isArray(f.switches) ? f.switches : []);
  const other = s => (s === 'left' ? 'right' : 'left');
  const firstSide = f => { const w = switchesOf(f); return w.length ? other(w[0].to) : f.side; };
  const sidesText = f => [firstSide(f), ...switchesOf(f).map(w => w.to)].join(' → ');
  // The time at the breast, cut where she changed side: [from, to, side].
  const sidedSpans = f => {
    const marks = switchesOf(f).map(w => [Date.parse(w.at), w.to]).sort((x, y) => x[0] - y[0]);
    const out = [];
    for (const [a, b] of activeSpans(f)) {
      let at = a, side = firstSide(f);
      for (const [t, to] of marks) { if (t <= a) { side = to; continue; } if (t >= b) break; out.push([at, t, side]); at = t; side = to; }
      out.push([at, b, side]);
    }
    return out.filter(([a, b]) => b > a);
  };
  // A feed stopped too early can be continued for this long after it ended; the gap becomes a pause.
  const CONTINUE_MS = 60 * 60000;
  const cares = () => all('care').sort((a, b) => new Date(b.at) - new Date(a.at));
  const vitaminToday = () => cares().find(c => c.kind === 'vitamin' && localDay(c.at) === today()) || null;
  const appointments = () => all('appointment').sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  const nextAppointment = () => appointments().find(a => !a.done && a.at && new Date(a.at) >= new Date(Date.now() - 3600000)) || null;
  const journal = () => all('journal').sort((a, b) => b.on.localeCompare(a.on) || b.rev - a.rev);
  const news = () => all('news').sort((a, b) => b.on.localeCompare(a.on) || b.rev - a.rev);
  const photosOf = rec => (rec.photos || []).map(id => state.records.get(id)).filter(p => p && !p.deleted);
  const reactionsOf = id => { const out = new Map(EMOJI.map(e => [e, { n: 0, mine: false }])); for (const r of all('reaction')) if (r.news === id && out.has(r.emoji)) { const x = out.get(r.emoji); x.n += 1; if (state.me && r.who === state.me) x.mine = true; } return out; };
  const groupByDay = (list, key) => { const groups = new Map(); for (const r of list) { const day = localDay(r[key]); if (!groups.has(day)) groups.set(day, []); groups.get(day).push(r); } return groups; };

  // ---- api ------------------------------------------------------------------
  async function api(path, options = {}) {
    let res;
    try { res = await fetch(path, { credentials: 'same-origin', ...options }); } catch { throw new Error('No connection. Nothing was saved.'); }
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && state.role) { state.role = null; render(); }
    if (!res.ok) throw new Error(body.message || `The server answered ${res.status}.`);
    return body;
  }
  const post = (path, data) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  async function save(rec) {
    try {
      const { record } = await api('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maia-Push': push.id || '' }, body: JSON.stringify(rec) });
      state.records.set(record.id, record);
      render();
      return record;
    } catch (error) { toast(error.message); throw error; }
  }
  async function loadRecords() {
    const { records, me } = await api('/api/records', { headers: { 'X-Maia-Device': device } });
    state.records = new Map(records.map(r => [r.id, r]));
    state.me = me || null;
  }
  function connect() {
    if (state.socket || typeof io === 'undefined') return;
    state.socket = io('/maia', { withCredentials: true });
    state.socket.on('maia:record', rec => { const have = state.records.get(rec.id); if (!have || have.rev < rec.rev) { state.records.set(rec.id, rec); render(); } });
    state.socket.on('connect', () => { if (state.role) loadRecords().then(render).catch(() => {}); });
  }
  // Leaving the page ends a visit: coming back compares the news with what was seen until then.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { state.seenBefore = undefined; return; } if (state.role) loadRecords().then(render).catch(() => {}); });

  // ---- boot ----------------------------------------------------------------
  async function boot() {
    try {
      const me = await api('/api/me');
      state.facts = me.facts; state.role = me.role;
      if (state.role) { await loadRecords(); connect(); pushInit(); }
    } catch (error) { state.gateError = error.message; }
    app.removeAttribute('aria-busy');
    render();
  }

  // ---- rendering -------------------------------------------------------------
  function render() {
    if (tipFor) hideTip();
    const swiped = new Map([...app.querySelectorAll('[data-gallery]')].map(g => [g.dataset.gallery, g.querySelector('.slides').scrollLeft]));
    document.documentElement.lang = state.role === 'parents' ? 'en' : (state.lang === 'zh' ? 'zh-Hant' : state.lang);
    if (!state.role) app.innerHTML = gate();
    else if (state.role === 'family') app.innerHTML = familyPage();
    else app.innerHTML = parentsPage();
    for (const g of app.querySelectorAll('[data-gallery]')) { const left = swiped.get(g.dataset.gallery); if (left) { g.querySelector('.slides').scrollLeft = left; galleryMark(g); } }
    tick();
  }
  const themeButton = () => `<button class="btn btn-ghost" type="button" data-action="theme" aria-label="${esc(I.t(state.lang, 'theme'))}" title="${esc(I.t(state.lang, 'theme'))}">${A.icon('sun', 'when-day')}${A.icon('moon', 'when-night')}</button>`;
  const langSwitch = () => `<div class="lang-switch" role="group" aria-label="${esc(I.t(state.lang, 'language'))}">${I.LANGS.map(l => `<button type="button" data-action="lang" data-lang="${l}" aria-pressed="${l === state.lang}" lang="${l === 'zh' ? 'zh-Hant' : l}">${esc(I.STRINGS[l].lang)}</button>`).join('')}</div>`;
  const NAME = 'Maïa';
  const facts = () => ({ born: '2026-11-04T20:44:00+01:00', weight: 3500, height: 49, timezone: 'Europe/Paris', ...(state.facts || {}), name: NAME });
  function masthead(lang) {
    const f = facts(), born = new Date(f.born);
    return `<header class="masthead">${A.header()}<h1>${esc(f.name)}</h1>
      <p class="age">${esc(I.t(lang, 'age', { age: I.age(lang, f.born) }))}</p>
      <p class="tagline"><span>${esc(I.t(lang, 'born', { date: I.dateLong(lang, born, f.timezone), time: I.timeShort(lang, born, f.timezone) }))}</span> · <span>${esc(I.t(lang, 'measures', { weight: I.number(lang, f.weight / 1000, 3), height: f.height }))}</span></p>
    </header>`;
  }
  function gate() {
    const L = state.lang;
    return `<div class="topbar">${themeButton()}</div>${masthead(L)}
      <section class="gate">${langSwitch()}
        <form data-form="login" autocomplete="off">
          <label class="field"><span>${esc(I.t(L, 'password'))}</span><input type="password" name="password" required autocomplete="current-password" autofocus></label>
          <p class="error" role="alert">${esc(state.gateError)}</p>
          <button class="btn btn-primary btn-full" type="submit">${esc(I.t(L, 'enter'))}</button>
        </form>${A.sprig()}
      </section>`;
  }

  // What this phone saw last: the newest post's time when the news was last shown.
  // Posts written after it are new for this visit; once shown, they count as seen
  // for the next one. The first visit marks nothing, since everything is new.
  const SEEN = 'maia-seen';
  function familyPage() {
    const L = state.lang, posts = news();
    if (state.seenBefore === undefined) state.seenBefore = store.get(SEEN) || null;
    const latest = posts.reduce((m, p) => (p.at > m ? p.at : m), '');
    if (latest && latest > (store.get(SEEN) || '') && document.visibilityState === 'visible') store.set(SEEN, latest); // a page left open in the background sees nothing
    const isNew = p => Boolean(state.seenBefore) && p.at > state.seenBefore;
    const fresh = posts.filter(isNew).length;
    const status = !state.seenBefore || !posts.length ? ''
      : fresh ? `<p class="news-status has-new" role="status"><span class="badge-new">${esc(I.t(L, 'newPost'))}</span> ${esc(I.t(L, 'newSince', { n: fresh }))}</p>`
        : `<p class="news-status" role="status">${A.icon('check', 'inline')} ${esc(I.t(L, 'upToDate'))}</p>`;
    return `<div class="topbar">${themeButton()}<button class="btn btn-ghost" type="button" data-action="logout" aria-label="${esc(I.t(L, 'signOut'))}" title="${esc(I.t(L, 'signOut'))}">${A.icon('leave')}</button></div>
      ${masthead(L)}${langSwitch()}
      <p class="note" style="text-align:center">${esc(I.t(L, 'familyWelcome'))}</p>
      <h2>${esc(I.t(L, 'news'))}</h2>${status}
      ${posts.length ? byDay(posts).map(([on, list]) => `<section class="card day-card${list.some(isNew) ? ' has-new' : ''}" lang="${L === 'zh' ? 'zh-Hant' : L}"><div class="date">${esc(I.dateLong(L, new Date(on + 'T12:00:00')))}</div>${list.map(p => newsPost(p, L, isNew(p))).join('')}</section>`).join('') : `${A.nest()}<p class="empty">${esc(I.t(L, 'noNews'))}</p>`}`;
  }
  const newsPost = (p, L, fresh) => `<article class="entry${fresh ? ' is-new' : ''}">
    ${fresh ? `<span class="badge-new">${esc(I.t(L, 'newPost'))}</span>` : ''}<h3>${esc(I.pick(p.title, L) || I.t(L, 'untitled'))}</h3>
    <div class="text">${esc(I.pick(p.text, L))}</div>
    ${photoGrid(photosOf(p), I.t(L, 'photoAlt'), L, p.id)}
    ${reactionRow(p, L)}
  </article>`;
  // One button per emoji, with how many gave it; this phone's own are pressed.
  const reactionRow = (p, L) => `<div class="reactions" role="group" aria-label="${esc(I.t(L, 'reactions'))}">${[...reactionsOf(p.id)].map(([e, { n, mine }]) => `<button type="button" class="react" data-action="react" data-id="${p.id}" data-emoji="${e}" aria-pressed="${mine}" aria-label="${esc(I.t(L, 'react', { emoji: e }))}${n ? ` (${n})` : ''}"><span class="emo" aria-hidden="true">${e}</span>${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
  // Entries of the same day share one card: the date once, then each entry in the order it was written.
  const byDay = list => { const days = new Map(); for (const r of list) { if (!days.has(r.on)) days.set(r.on, []); days.get(r.on).push(r); } for (const l of days.values()) l.sort((a, b) => a.rev - b.rev); return [...days]; };
  // One photo shows whole; several become a gallery to swipe, each photo whole, with a count and arrows.
  const photoLink = (p, alt) => `<a href="/photos/${p.id}" target="_blank" rel="noopener"><img src="/photos/${p.id}" alt="${esc(alt)}" loading="lazy" width="${p.w || ''}" height="${p.h || ''}"></a>`;
  const photoGrid = (photos, alt, L = 'en', key = '') => {
    if (!photos.length) return '';
    if (photos.length === 1) return `<div class="photos single">${photoLink(photos[0], alt)}</div>`;
    const n = photos.length;
    return `<div class="gallery" data-gallery="${esc(key)}">
      <div class="slides" tabindex="0" role="group" aria-label="${esc(alt)} (${n})">${photos.map((p, i) => `<div class="slide" aria-label="${esc(I.t(L, 'photoOf', { i: i + 1, n }))}">${photoLink(p, alt)}</div>`).join('')}</div>
      <div class="gallery-bar"><button class="btn btn-ghost" type="button" data-action="slide" data-dir="-1" aria-label="${esc(I.t(L, 'prevPhoto'))}" disabled>‹</button><span class="dots" aria-hidden="true">${photos.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span><span class="count" aria-live="polite">1 / ${n}</span><button class="btn btn-ghost" type="button" data-action="slide" data-dir="1" aria-label="${esc(I.t(L, 'nextPhoto'))}">›</button></div>
    </div>`;
  };
  // Which photo a gallery shows, from how far it has been swiped.
  const galleryAt = g => { const s = g.querySelector('.slides'); return Math.max(0, Math.min(s.children.length - 1, Math.round(s.scrollLeft / (s.clientWidth || 1)))); };
  const galleryMark = g => {
    const n = g.querySelector('.slides').children.length, i = galleryAt(g);
    g.querySelector('.count').textContent = `${i + 1} / ${n}`;
    g.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const [prev, next] = g.querySelectorAll('[data-action=slide]'); prev.disabled = i === 0; next.disabled = i === n - 1;
  };

  function parentsPage() {
    const v = view();
    const tabs = [['today', 'Today'], ['feeds', 'Feeds'], ['journal', 'Journal'], ['care', 'Care'], ['news', 'News']];
    return `<div class="topbar">${themeButton()}<button class="btn btn-ghost" type="button" data-action="logout" aria-label="Leave" title="Leave">${A.icon('leave')}</button></div>
      ${masthead('en')}
      <nav class="tabs" aria-label="Tools">${tabs.map(([id, label]) => `<a href="#${id}" ${v === id ? 'aria-current="page"' : ''}>${A.icon(id)}<span>${label}</span></a>`).join('')}</nav>
      <main id="view-${v}">${({ today: todayView, feeds: feedsView, journal: journalView, care: careView, news: newsView })[v]()}</main>`;
  }

  function todayView() {
    const run = running(), last = lastDone(), todays = feeds().filter(f => localDay(f.start) === today());
    const vit = vitaminToday(), next = nextAppointment();
    const suggest = last ? (last.side === 'left' ? 'right' : last.side === 'right' ? 'left' : 'either side') : 'either side';
    return `<section class="card" aria-labelledby="feed-now">
      <div class="card-head"><h2 id="feed-now" style="margin:0">${run ? `${isPaused(run) ? 'Paused' : 'Feeding'}, ${run.side}` : 'Feeding'}</h2>${run ? `<span class="pill">since ${fmtTime(run.start)}</span>` : ''}</div>
      ${run ? `<div class="timer${isPaused(run) ? ' paused' : ''}" data-feed="${run.id}">${elapsed(feedMs(run))}<small>${isPaused(run) ? `paused at ${fmtTime(pausesOf(run).find(p => !p.end).start)}` : run.side === 'both' ? 'both sides' : `${run.side} side${switchesOf(run).length ? ` since ${fmtTime(switchesOf(run)[switchesOf(run).length - 1].at)}` : ''}`}</small></div>
        <div class="row">${isPaused(run) ? `<button class="btn btn-big btn-primary" type="button" data-action="resume-feed" data-id="${run.id}">${A.icon('play')}Resume</button>` : `<button class="btn btn-big" type="button" data-action="pause-feed" data-id="${run.id}">${A.icon('pause')}Pause</button>`}<button class="btn btn-big btn-bark" type="button" data-action="stop-feed" data-id="${run.id}">${A.icon('stop')}Stop</button></div>
        ${run.side === 'both' ? '' : `<div class="row" style="margin-top:8px"><button class="btn btn-big" type="button" data-action="switch-side" data-id="${run.id}">${A.icon(other(run.side))}Switch to ${other(run.side)}</button></div>`}<div class="row" style="margin-top:8px"><button class="btn" type="button" data-action="edit-feed" data-id="${run.id}">${A.icon('pen')}Fix the start or add a note</button></div>`
      : `<p class="note">${last ? `Last feed ${ago(last.end)}: ${sidesText(last)}, ${duration(feedMs(last))}. Next, ${suggest}.` : 'No feed logged yet. Tap a side when she starts.'}</p>
        ${last && Date.now() - Date.parse(last.end) < CONTINUE_MS ? `<div class="row" style="margin-bottom:8px"><button class="btn" type="button" data-action="continue-feed" data-id="${last.id}">${A.icon('play')}Continue the last feed (${last.side})</button></div>` : ''}
        <div class="row"><button class="btn btn-big ${suggest === 'left' ? 'btn-primary' : ''}" type="button" data-action="start-feed" data-side="left">${A.icon('left')}Left</button><button class="btn btn-big ${suggest === 'right' ? 'btn-primary' : ''}" type="button" data-action="start-feed" data-side="right">${A.icon('right')}Right</button></div>
        <div class="row" style="margin-top:8px"><button class="btn" type="button" data-action="add-feed">${A.icon('plus')}A past feed</button></div>`}
    </section>
    <section class="card" aria-label="Today">
      <div class="stat-row"><div class="stat"><b>${todays.length}</b><span>feeds today</span></div><div class="stat"><b>${duration(todays.reduce((s, f) => s + feedMs(f), 0))}</b><span>at the breast</span></div><div class="stat"><b>${I.age('en', facts().born).replace(' old', '')}</b><span>old</span></div></div>
    </section>
    <section class="card" aria-label="Care today">
      <div class="row"><button class="btn ${vit ? 'btn-primary' : ''}" type="button" data-action="vitamin" aria-pressed="${Boolean(vit)}">${A.icon(vit ? 'check' : 'drop')}${vit ? `Vitamin D given at ${fmtTime(vit.at)}` : 'Vitamin D not yet today'}</button></div>
      ${next ? `<p style="margin:12px 0 0">${A.icon('calendar', 'inline')} <b>${esc(next.title)}</b>, ${fmtDateTime(next.at)}${next.place ? `, ${esc(next.place)}` : ''}</p>` : '<p class="note" style="margin:12px 0 0">No appointment coming.</p>'}
    </section>${remindersCard()}${A.sprig()}`;
  }

  // ---- reminders, by Web Push ------------------------------------------------
  // Each phone subscribes on its own and keeps its own choices on the server.
  // An iPhone only pushes from the home-screen app, so the card says so there.
  const push = {
    ready: false, busy: false, sub: null, id: store.get('maia-push-id') || null, settings: null, key: null, defaults: null,
    supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    ios: /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  };
  const b64 = s => { const raw = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  async function pushInit() {
    if (!push.supported || state.role !== 'parents') { push.ready = true; return; }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      push.sub = await reg.pushManager.getSubscription();
      const st = await post('/api/push/state', { endpoint: push.sub ? push.sub.endpoint : '' });
      push.key = st.key; push.defaults = st.defaults; push.id = st.id; push.settings = st.settings;
      store.set('maia-push-id', push.id || '');
    } catch (error) { push.error = error.message; }
    push.ready = true;
    if (state.role === 'parents' && view() === 'today') render();
  }
  async function pushSettings(settings) {
    if (!push.sub) return;
    try { const r = await post('/api/push/subscribe', { subscription: push.sub.toJSON(), settings }); push.settings = r.settings; } catch (error) { toast(error.message); }
  }
  function remindersCard() {
    const head = title => `<h2 id="reminders" style="margin:0 0 6px">${title}</h2>`;
    if (!push.supported) return `<section class="card" aria-labelledby="reminders">${head('Reminders')}<p class="note" style="margin:0">${push.ios && !push.standalone ? 'On an iPhone, reminders come from the home-screen app: Share, then “Add to Home Screen”, and open it from there.' : 'This browser cannot show reminders. Chrome on Android or the home-screen app on an iPhone can.'}</p></section>`;
    if (!push.ready) return '';
    if (!push.id || !push.settings) return `<section class="card" aria-labelledby="reminders">${head('Reminders')}<p class="note">Vitamin D, appointments, a feed that runs long, a long gap between feeds, and new journal pages, as notes on this phone.</p>
      <div class="row"><button class="btn" type="button" data-action="push-on" ${push.busy ? 'disabled' : ''}>${A.icon('bell')}${push.busy ? 'Asking the phone…' : 'Turn on reminders on this phone'}</button></div>${push.error ? `<p class="note" style="margin:8px 0 0">${esc(push.error)}</p>` : ''}</section>`;
    const s = push.settings, on = k => (s[k] ? 'checked' : '');
    const line = (k, text, extra = '') => `<div class="check"><input type="checkbox" id="rem-${k}" name="${k}" ${on(k)}><label for="rem-${k}">${text}</label>${extra}</div>`;
    return `<section class="card" aria-labelledby="reminders">${head('Reminders on this phone')}
      <form data-form="reminders">
        ${line('vitamin', 'Vitamin D not logged by', `<input type="time" name="vitaminAt" value="${esc(s.vitaminAt)}" aria-label="Vitamin D reminder time">`)}
        ${line('appointments', 'Appointments, the evening before and an hour before')}
        ${line('longFeed', 'A feed still running after 40 minutes')}
        ${line('noFeed', 'No feed for 2½ hours, then every 30 minutes')}
        ${line('journal', 'A new page in the journal, written on the other phone')}
      </form>
      <div class="row" style="margin-top:8px"><button class="btn btn-ghost" type="button" data-action="push-off">${A.icon('bell-off')}Turn off on this phone</button></div></section>`;
  }

  // ---- the rhythm of the feeds --------------------------------------------------
  // Regularity: one 24-hour strip per day for the last week, each feed drawn
  // where it happened and coloured by side. Quantity: minutes at the breast per
  // day over two weeks. The list below the card is the table of every value.
  const DAY_MS = 86400000, H = 3600000;
  const dayStart = (d, back = 0) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - back); return x.getTime(); };
  const span = f => [Date.parse(f.start), f.end ? Date.parse(f.end) : Date.now()];
  const inDay = (f, from) => activeIn(f, from, from + DAY_MS);
  const sideName = s => (s === 'both' ? 'Both sides' : s === 'left' ? 'Left' : 'Right');
  const niceStep = max => [15, 30, 60, 90, 120, 180, 240].find(s => max / s <= 3) || 300;
  function rhythmCard() {
    const list = feeds();
    if (!list.length) return '';
    const now = Date.now();
    // The last 24 hours, in figures.
    const recent = list.filter(f => span(f)[1] > now - DAY_MS).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const atBreast = recent.reduce((s, f) => s + activeIn(f, now - DAY_MS, now), 0);
    const starts = list.filter(f => Date.parse(f.start) > now - DAY_MS).map(f => Date.parse(f.start)).sort((a, b) => a - b);
    const every = starts.length > 1 ? (starts[starts.length - 1] - starts[0]) / (starts.length - 1) : null;
    const done = list.filter(f => f.end).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    let longest = 0;
    for (let i = 1; i < done.length; i++) { const gapEnd = Date.parse(done[i].start); if (gapEnd > now - DAY_MS) longest = Math.max(longest, gapEnd - Date.parse(done[i - 1].end)); }
    const run = running(), last = lastDone();
    if (!run && last && Date.parse(last.end) > now - DAY_MS) longest = Math.max(longest, now - Date.parse(last.end));
    const stat = (value, label) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
    const figures = `<div class="stat-row rhythm-stats">${stat(recent.length, 'feeds in 24 h')}${stat(duration(atBreast), 'at the breast')}${stat(every ? duration(every) : '–', 'between starts')}${stat(longest ? duration(longest) : '–', 'longest gap')}</div>`;

    // A week of days, today on top.
    const strip = back => {
      const from = dayStart(now, back), day = localDay(from);
      const marks = list.filter(f => inDay(f, from) > 0).map(f => {
        const [a, b] = span(f);
        const tip = `${switchesOf(f).length ? sidesText(f).replace(/^./, c => c.toUpperCase()) : sideName(f.side)}, ${fmtTime(a)}${f.end ? `–${fmtTime(b)}` : isPaused(f) ? ', paused' : ', still going'} · ${duration(feedMs(f))}${pausesOf(f).length ? ` (${pausesOf(f).length} pause${pausesOf(f).length > 1 ? 's' : ''})` : ''}`;
        // Only the time at the breast is drawn; a pause leaves the strip empty.
        const pieces = sidedSpans(f), lastPiece = pieces[pieces.length - 1];
        return pieces.map(piece => { const x = Math.max(piece[0], from), y = Math.min(piece[1], from + DAY_MS); return y > x ? [piece, x, y] : null; }).filter(Boolean)
          .map(([piece, x, y]) => `<span class="feed-mark side-${piece[2]}${!f.end && !isPaused(f) && piece === lastPiece ? ' running' : ''}" style="left:${((x - from) / DAY_MS * 100).toFixed(2)}%;width:${((y - x) / DAY_MS * 100).toFixed(2)}%" data-tip="${esc(tip)}"></span>`).join('');
      }).join('');
      const count = list.filter(f => { const s = Date.parse(f.start); return s >= from && s < from + DAY_MS; }).length;
      const label = back === 0 ? 'Today' : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' }).format(new Date(from));
      const future = back === 0 ? `<span class="track-future" style="left:${((now - from) / DAY_MS * 100).toFixed(2)}%"></span>` : '';
      return `<div class="strip" role="img" aria-label="${esc(`${fmtDay(day)}: ${count} feed${count === 1 ? '' : 's'}, ${duration(list.reduce((s, f) => s + inDay(f, from), 0))}`)}"><span class="strip-day">${label}</span><span class="track" aria-hidden="true">${marks}${future}</span></div>`;
    };
    // Days start with the first feed logged, so days before the log began never look like days without feeds.
    const born = dayStart(Math.min(...list.map(f => Date.parse(f.start))));
    const weekDays = Math.min(7, Math.round((dayStart(now) - born) / DAY_MS) + 1);
    const legend = `<div class="legend" aria-hidden="true">${['left', 'right', 'both'].map(s => `<span><i class="swatch side-${s}"></i>${sideName(s)}</span>`).join('')}</div>`;
    const week = `<h3 class="chart-title">When she fed</h3>${legend}
      <div class="strips">${Array.from({ length: weekDays }, (_, i) => strip(i)).join('')}
        <div class="strip strip-axis" aria-hidden="true"><span class="strip-day"></span><span class="track-axis">${[0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${pad(h)}</span>`).join('')}</span></div></div>`;

    // Two weeks of minutes at the breast.
    const nDays = Math.min(14, Math.round((dayStart(now) - born) / DAY_MS) + 1);
    const days = Array.from({ length: nDays }, (_, i) => { const from = dayStart(now, nDays - 1 - i); return { from, ms: list.reduce((s, f) => s + inDay(f, from), 0), n: list.filter(f => { const s = Date.parse(f.start); return s >= from && s < from + DAY_MS; }).length }; });
    const maxMin = Math.max(30, ...days.map(d => minutes(d.ms)));
    const step = niceStep(maxMin), top = Math.ceil(maxMin / step) * step;
    const best = days.reduce((m, d) => (d.ms > m.ms ? d : m), days[0]);
    const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
    const bars = days.map((d, i) => {
      const isToday = i === days.length - 1;
      const label = (isToday || d === best) && d.ms ? `<span class="bar-value">${duration(d.ms)}</span>` : '';
      const date = new Date(d.from);
      const tip = `${new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)} · ${d.n} feed${d.n === 1 ? '' : 's'} · ${duration(d.ms)}${isToday ? ' so far' : ''}`;
      return `<div class="bar-col${isToday ? ' today' : ''}" data-tip="${esc(tip)}"><div class="bar-area"><span class="bar${isToday ? ' partial' : ''}" style="height:${(minutes(d.ms) / top * 100).toFixed(1)}%">${label}</span></div><span class="bar-day">${date.getDate()}</span></div>`;
    }).join('');
    const amounts = `<h3 class="chart-title">Minutes at the breast, per day</h3>
      <div class="bars" role="img" aria-label="${esc(days.map(d => `${new Date(d.from).getDate()}: ${duration(d.ms)}`).join(', '))}">
        <div class="bars-grid" aria-hidden="true">${ticks.map(t => `<span style="bottom:${t / top * 100}%"><b>${t === 0 ? '0' : t >= 60 ? `${t / 60} h` : `${t} min`}</b></span>`).join('')}</div>
        <div class="bars-cols" aria-hidden="true">${bars}</div></div>`;
    return `<section class="card rhythm" aria-labelledby="rhythm-title"><h2 id="rhythm-title" style="margin:0 0 8px">Rhythm</h2>${figures}${week}${amounts}</section>`;
  }

  function feedsView() {
    const groups = groupByDay(feeds(), 'start');
    return `<h2>Feeds</h2>${rhythmCard()}<div class="row"><button class="btn" type="button" data-action="add-feed">${A.icon('plus')}Add a past feed</button></div>
      ${groups.size ? [...groups].map(([day, list]) => `<div class="day-head"><span>${fmtDay(day)}</span><small>${list.length} feed${list.length > 1 ? 's' : ''}, ${duration(list.reduce((s, f) => s + feedMs(f), 0))}</small></div>
        <ul class="list card" style="padding:4px 16px">${list.map(f => `<li><button class="rowbtn" type="button" data-action="edit-feed" data-id="${f.id}" aria-label="Edit the ${f.side} feed at ${fmtTime(f.start)}">${A.icon(f.side)}<span class="when">${fmtTime(f.start)}</span><span class="what">${sidesText(f)}${isPaused(f) ? ' · paused' : ''}${f.note ? `<small>${esc(f.note)}</small>` : ''}</span><span class="amount" ${f.end ? '' : `data-feed="${f.id}"`}>${f.end ? duration(feedMs(f)) : elapsed(feedMs(f))}</span></button></li>`).join('')}</ul>`).join('')
      : `${A.nest()}<p class="empty">Nothing logged yet.</p>`}`;
  }

  function journalView() {
    const entries = journal();
    return `<h2>Journal</h2><div class="row"><button class="btn btn-primary" type="button" data-action="add-journal">${A.icon('pen')}Write today</button></div>
      ${entries.length ? byDay(entries).map(([on, list]) => `<section class="card day-card"><div class="date">${fmtDay(on)}</div>${list.map(e => `<article class="entry">${e.title ? `<h3>${esc(e.title)}</h3>` : ''}
        ${(e.weight || e.height || e.head) ? `<div class="measures">${e.weight ? `<span>${I.number('en', e.weight / 1000, 3)} kg</span>` : ''}${e.height ? `<span>${e.height} cm</span>` : ''}${e.head ? `<span>head ${e.head} cm</span>` : ''}</div>` : ''}
        <div class="text">${esc(e.text)}</div>${photoGrid(photosOf(e), NAME, 'en', e.id)}
        <div class="entry-actions"><button class="btn" type="button" data-action="edit-journal" data-id="${e.id}">${A.icon('pen')}Edit</button><button class="btn" type="button" data-action="share-journal" data-id="${e.id}">${A.icon('news')}Tell the family</button></div></article>`).join('')}</section>`).join('')
      : `${A.nest()}<p class="empty">The first page is still blank.</p>`}`;
  }

  function careView() {
    const list = cares(), groups = groupByDay(list, 'at'), appts = appointments();
    const upcoming = appts.filter(a => !a.done), done = appts.filter(a => a.done);
    return `<h2>Appointments</h2><div class="row"><button class="btn" type="button" data-action="add-appointment">${A.icon('calendar')}Add an appointment</button></div>
      ${appts.length ? `<ul class="list card wrap" style="padding:4px 16px">${upcoming.concat(done).map(a => `<li><button class="btn btn-ghost" type="button" data-action="toggle-appointment" data-id="${a.id}" aria-pressed="${a.done}" aria-label="${a.done ? 'Not done' : 'Done'}: ${esc(a.title)}" style="min-width:var(--tap);padding:0">${A.icon(a.done ? 'check' : 'calendar')}</button><button class="rowbtn" type="button" data-action="edit-appointment" data-id="${a.id}"><span class="what ${a.done ? 'done' : ''}">${esc(a.title)}<small>${a.at ? fmtDateTime(a.at) : 'no date'}${a.place ? ` · ${esc(a.place)}` : ''}${a.note ? ` · ${esc(a.note)}` : ''}</small></span></button></li>`).join('')}</ul>` : '<p class="empty">None planned.</p>'}
      <h2>Vitamins and medicine</h2><div class="row"><button class="btn" type="button" data-action="add-care">${A.icon('pill')}Log a dose</button></div>
      ${groups.size ? [...groups].map(([day, items]) => `<div class="day-head"><span>${fmtDay(day)}</span></div><ul class="list card wrap" style="padding:4px 16px">${items.map(c => `<li><button class="rowbtn" type="button" data-action="edit-care" data-id="${c.id}">${A.icon(c.kind === 'vitamin' ? 'drop' : 'pill')}<span class="when">${fmtTime(c.at)}</span><span class="what">${esc(c.name)}${c.dose || c.note ? `<small>${esc([c.dose, c.note].filter(Boolean).join(' · '))}</small>` : ''}</span></button></li>`).join('')}</ul>`).join('') : `${A.nest()}<p class="empty">No dose logged yet.</p>`}`;
  }

  function newsView() {
    const posts = news();
    return `<h2>News for the family</h2><p class="note">What you write here is read by the family in French, English or Chinese; a missing translation shows another language.</p>
      <div class="row"><button class="btn btn-primary" type="button" data-action="add-news">${A.icon('news')}Write some news</button></div>
      <div class="row" style="margin-top:8px"><button class="btn" type="button" data-action="family-link">${A.icon('share')}Share the family link</button></div>
      <p class="note" style="margin:6px 0 0;font-size:16px">The link carries the family password and opens the news in one tap. Anyone who has it can read the news.</p>
      ${posts.length ? byDay(posts).map(([on, list]) => `<section class="card day-card"><div class="date">${fmtDay(on)}</div>${list.map(p => `<article class="entry"><div class="langs">${I.LANGS.filter(l => p.title[l] || p.text[l]).map(l => l.toUpperCase()).join(' ') || 'empty'}</div><h3>${esc(I.pick(p.title, 'en') || 'Untitled')}</h3><div class="text">${esc(I.pick(p.text, 'en'))}</div>${photoGrid(photosOf(p), NAME, 'en', p.id)}${reactionRow(p, 'en')}
        <div class="entry-actions"><button class="btn" type="button" data-action="edit-news" data-id="${p.id}">${A.icon('pen')}Edit</button></div></article>`).join('')}</section>`).join('') : `${A.nest()}<p class="empty">Nothing told yet.</p>`}`;
  }

  // ---- the clock on a running feed -------------------------------------------
  function tick() {
    clearInterval(state.ticker);
    const update = () => { for (const el of document.querySelectorAll('[data-feed]')) { const rec = state.records.get(el.dataset.feed); if (!rec) continue; const text = elapsed(feedMs(rec)); const small = el.querySelector('small'); if (small) el.firstChild.nodeValue = text; else el.textContent = text; } };
    if (document.querySelector('[data-feed]') && !matchMedia('(prefers-reduced-motion: reduce)').matches) state.ticker = setInterval(update, 1000);
    else if (document.querySelector('[data-feed]')) state.ticker = setInterval(update, 15000);
  }

  // ---- dialogs ----------------------------------------------------------------
  let toastTimer;
  function toast(message) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 4000);
  }
  function dialog({ title, body, submit = 'Save', remove = null, onSubmit, onRemove }) {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog" novalidate><h2>${esc(title)}</h2>${body}<div class="actions">${remove ? `<button class="btn btn-danger" type="button" data-remove>${A.icon('trash')}${esc(remove)}</button>` : ''}<button class="btn" type="button" data-cancel>Cancel</button><button class="btn btn-primary" type="submit">${esc(submit)}</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
    if (remove) dlg.querySelector('[data-remove]').addEventListener('click', async () => { if (confirm(`${remove}?`)) { await onRemove(); dlg.close(); } });
    form.addEventListener('submit', async event => { event.preventDefault(); if (!form.reportValidity()) return; const data = Object.fromEntries(new FormData(form)); try { await onSubmit(data, dlg); dlg.close(); } catch { /* the toast said why; the dialog stays */ } });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    return dlg;
  }
  const field = (label, name, type = 'text', value = '', extra = '') => `<label class="field"><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(value ?? '')}" ${extra}></label>`;
  const area = (label, name, value = '', extra = '') => `<label class="field"><span>${esc(label)}</span><textarea name="${name}" ${extra}>${esc(value ?? '')}</textarea></label>`;
  const select = (label, name, options, value) => `<label class="field"><span>${esc(label)}</span><select name="${name}">${options.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

  function feedDialog(rec) {
    const isNew = !rec;
    rec = rec || { side: lastDone() && lastDone().side === 'left' ? 'right' : 'left', start: new Date(Date.now() - 15 * 60000).toISOString(), end: new Date().toISOString(), note: '' };
    dialog({
      title: isNew ? 'A past feed' : 'This feed', remove: isNew ? null : 'Delete this feed',
      body: `${select(switchesOf(rec).length ? 'Side at the end' : 'Side', 'side', [['left', 'Left'], ['right', 'Right'], ['both', 'Both sides']], rec.side)}${switchesOf(rec).length ? `<p class="note" style="margin:-4px 0 10px">${esc(sidesText(rec))}, switched at ${switchesOf(rec).map(w => fmtTime(w.at)).join(', ')}. Changing the side forgets the switches.</p>` : ''}<div class="fields-2">${field('Started', 'start', 'datetime-local', toInput(rec.start), 'required')}${field('Ended', 'end', 'datetime-local', rec.end ? toInput(rec.end) : '', rec.end ? '' : 'placeholder="still going"')}</div>${area('Note', 'note', rec.note, 'rows="2"')}`,
      onSubmit: d => save({ ...rec, type: 'feed', side: d.side, switches: d.side === rec.side ? switchesOf(rec) : [], start: fromInput(d.start), end: fromInput(d.end), note: d.note.trim() }),
      onRemove: () => save({ id: rec.id, deleted: true }),
    });
  }
  function careDialog(rec) {
    const isNew = !rec;
    rec = rec || { kind: 'vitamin', name: 'Vitamin D', dose: '', at: new Date().toISOString(), note: '' };
    dialog({
      title: isNew ? 'A dose' : 'This dose', remove: isNew ? null : 'Delete this dose',
      body: `${select('What', 'kind', [['vitamin', 'Vitamin'], ['medicine', 'Medicine']], rec.kind)}${field('Name', 'name', 'text', rec.name, 'required')}<div class="fields-2">${field('Dose', 'dose', 'text', rec.dose, 'placeholder="2 drops"')}${field('When', 'at', 'datetime-local', toInput(rec.at), 'required')}</div>${area('Note', 'note', rec.note, 'rows="2"')}`,
      onSubmit: d => save({ ...rec, type: 'care', kind: d.kind, name: d.name.trim(), dose: d.dose.trim(), at: fromInput(d.at), note: d.note.trim() }),
      onRemove: () => save({ id: rec.id, deleted: true }),
    });
  }
  function appointmentDialog(rec) {
    const isNew = !rec;
    rec = rec || { title: '', at: new Date(Date.now() + 86400000).toISOString(), place: '', note: '', done: false };
    dialog({
      title: isNew ? 'An appointment' : 'This appointment', remove: isNew ? null : 'Delete this appointment',
      body: `${field('What', 'title', 'text', rec.title, 'required placeholder="Pediatrician"')}<div class="fields-2">${field('When', 'at', 'datetime-local', rec.at ? toInput(rec.at) : '')}${field('Where', 'place', 'text', rec.place)}</div>${area('Note', 'note', rec.note, 'rows="3"')}`,
      onSubmit: d => save({ ...rec, type: 'appointment', title: d.title.trim(), at: fromInput(d.at), place: d.place.trim(), note: d.note.trim() }),
      onRemove: () => save({ id: rec.id, deleted: true }),
    });
  }

  // Photos: picked on the phone, shrunk on a canvas, sent as JPEG; the server
  // keeps them under /photos/<id>. A dialog keeps the ids it has attached.
  async function shrink(file, max = 1600) {
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bitmap = await createImageBitmap(file); }
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
    if (!blob) throw new Error('Could not read that picture.');
    return { blob, w, h };
  }
  async function upload(file, audience) {
    const { blob, w, h } = await shrink(file);
    const res = await fetch(`/api/photos?w=${w}&h=${h}&audience=${audience}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'The photo was not kept.');
    state.records.set(body.record.id, body.record);
    return body.record;
  }
  // The photo strip inside a dialog: attached photos, a picker, and for news the recent journal photos to reuse.
  function photoStrip(dlg, ids, { audience, reuse }) {
    const strip = dlg.querySelector('[data-strip]'), input = dlg.querySelector('input[type=file]');
    // The recent photos stay folded until asked for, and stay as they were left while photos come and go.
    let recentOpen = false;
    const draw = () => {
      dlg.querySelector('[data-add-label]').textContent = ids.length ? 'Add more photos' : 'Add photos';
      const fold = strip.querySelector('details.recent'); if (fold) recentOpen = fold.open;
      const attached = ids.map(id => state.records.get(id)).filter(Boolean);
      const others = reuse ? all('photo').sort((a, b) => b.rev - a.rev).filter(p => !ids.includes(p.id)).slice(0, 12) : [];
      strip.innerHTML = `${attached.length ? `<p class="note" style="margin:0">${attached.length} photo${attached.length > 1 ? 's' : ''} attached${attached.length > 1 ? ', shown in this order' : ''}.</p><div class="photos">${attached.map((p, i) => `<div class="thumb attached"><img src="/photos/${p.id}" alt="Photo ${i + 1}"><button class="thumb-btn remove" type="button" data-detach="${p.id}" aria-label="Remove photo ${i + 1}"><span aria-hidden="true">×</span></button>${i ? `<button class="thumb-btn earlier" type="button" data-earlier="${p.id}" aria-label="Move photo ${i + 1} earlier">‹</button>` : ''}</div>`).join('')}</div>` : '<p class="note">No photo attached.</p>'}
        ${others.length ? `<details class="recent"${recentOpen ? ' open' : ''}><summary>Recent photos (${others.length})</summary><p class="note" style="margin-top:8px">Tap a photo to attach it:</p><div class="photos">${others.map(p => `<button class="thumb" type="button" data-attach="${p.id}" aria-label="Attach this photo"><img src="/photos/${p.id}" alt="" loading="lazy"></button>`).join('')}</div></details>` : ''}`;
    };
    strip.addEventListener('click', event => { const b = event.target.closest('[data-detach],[data-attach],[data-earlier]'); if (!b) return;
      if (b.dataset.detach) ids.splice(ids.indexOf(b.dataset.detach), 1);
      else if (b.dataset.earlier) { const i = ids.indexOf(b.dataset.earlier); if (i > 0) [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; }
      else ids.push(b.dataset.attach);
      draw(); });
    input.addEventListener('change', async () => {
      const files = [...input.files]; input.value = '';
      for (const [i, file] of files.entries()) {
        toast(`Sending photo ${i + 1} of ${files.length}…`);
        try { const rec = await upload(file, audience); ids.push(rec.id); draw(); } catch (error) { toast(error.message); }
      }
      if (files.length) toast(`${files.length} photo${files.length > 1 ? 's' : ''} attached.`);
    });
    draw();
  }
  const photoField = () => `<div class="field"><span>Photos</span><div data-strip></div><label class="btn" style="margin-top:8px">${A.icon('photo')}<span data-add-label>Add photos</span><input type="file" accept="image/*" multiple class="visually-hidden"></label></div>`;

  function journalDialog(rec) {
    const isNew = !rec;
    rec = rec || { on: today(), title: '', text: '', photos: [], weight: null, height: null, head: null };
    const ids = [...(rec.photos || [])];
    const dlg = dialog({
      title: isNew ? 'A page of the journal' : 'This page', remove: isNew ? null : 'Delete this page',
      body: `<div class="fields-2">${field('Day', 'on', 'date', rec.on, 'required')}${field('Title', 'title', 'text', rec.title)}</div>${area('What happened', 'text', rec.text, 'rows="6"')}<div class="fields-3">${field('Weight (g)', 'weight', 'number', rec.weight ?? '', 'min="500" max="30000" step="1" inputmode="numeric"')}${field('Height (cm)', 'height', 'number', rec.height ?? '', 'min="30" max="150" step="0.1" inputmode="decimal"')}${field('Head (cm)', 'head', 'number', rec.head ?? '', 'min="20" max="70" step="0.1" inputmode="decimal"')}</div>${photoField()}`,
      onSubmit: d => save({ ...rec, type: 'journal', on: d.on, title: d.title.trim(), text: d.text.trim(), photos: ids, weight: d.weight ? Number(d.weight) : null, height: d.height ? Number(d.height) : null, head: d.head ? Number(d.head) : null }),
      onRemove: () => save({ id: rec.id, deleted: true }),
    });
    photoStrip(dlg, ids, { audience: 'parents', reuse: false });
  }
  function newsDialog(rec, seed) {
    const isNew = !rec;
    rec = rec || { on: today(), title: { fr: '', en: '', zh: '' }, text: { fr: '', en: '', zh: '' }, photos: [], ...(seed || {}) };
    const ids = [...(rec.photos || [])];
    const L = { fr: 'Français', en: 'English', zh: '繁體中文' };
    const dlg = dialog({
      title: isNew ? 'News for the family' : 'This news', remove: isNew ? null : 'Delete this news', submit: 'Publish',
      body: `${field('Day', 'on', 'date', rec.on, 'required')}${I.LANGS.map(l => `<fieldset style="border:1px dashed var(--line);border-radius:10px;padding:8px 12px;margin:0 0 10px"><legend lang="${l === 'zh' ? 'zh-Hant' : l}">${L[l]}</legend>${field('Title', `title_${l}`, 'text', rec.title[l] || '', `lang="${l === 'zh' ? 'zh-Hant' : l}"`)}${area('Text', `text_${l}`, rec.text[l] || '', `rows="4" lang="${l === 'zh' ? 'zh-Hant' : l}"`)}</fieldset>`).join('')}${photoField()}`,
      onSubmit: d => {
        const title = {}, text = {};
        for (const l of I.LANGS) { if (d[`title_${l}`].trim()) title[l] = d[`title_${l}`].trim(); if (d[`text_${l}`].trim()) text[l] = d[`text_${l}`].trim(); }
        if (!Object.keys(title).length && !Object.keys(text).length && !ids.length) { toast('Write something, or attach a photo.'); throw new Error('empty'); }
        return save({ ...rec, type: 'news', on: d.on, title, text, photos: ids });
      },
      onRemove: () => save({ id: rec.id, deleted: true }),
    });
    photoStrip(dlg, ids, { audience: 'parents', reuse: true }); // publishing the news hands its photos to the family; one taken back stays private
  }

  // ---- actions --------------------------------------------------------------
  const actions = {
    theme() { const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night'; document.documentElement.dataset.theme = next; store.set('maia-theme', next); },
    slide(b) { const s = b.closest('[data-gallery]').querySelector('.slides'); s.scrollBy({ left: Number(b.dataset.dir) * s.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); },
    lang(b) { state.lang = b.dataset.lang; store.set('maia-lang', state.lang); render(); },
    async logout() { try { await post('/api/logout', {}); } catch { /* the cookie goes anyway */ } if (state.socket) { state.socket.disconnect(); state.socket = null; } state.role = null; state.records = new Map(); state.gateError = ''; state.me = null; state.seenBefore = undefined; location.hash = ''; render(); },
    'start-feed': b => save({ type: 'feed', side: b.dataset.side, start: new Date().toISOString(), end: null, note: '' }),
    'stop-feed': b => { const f = state.records.get(b.dataset.id); if (!f) return; const now = new Date().toISOString(); save({ ...f, end: now, pauses: pausesOf(f).map(p => (p.end ? p : { ...p, end: now })) }); },
    'pause-feed': b => { const f = state.records.get(b.dataset.id); if (f && !f.end && !isPaused(f)) save({ ...f, pauses: [...pausesOf(f), { start: new Date().toISOString(), end: null }] }); },
    'continue-feed': b => { const f = state.records.get(b.dataset.id); if (!f || !f.end || running()) return; save({ ...f, end: null, pauses: [...pausesOf(f), { start: f.end, end: new Date().toISOString() }] }); },
    'resume-feed': b => { const f = state.records.get(b.dataset.id); if (f && isPaused(f)) { const now = new Date().toISOString(); save({ ...f, pauses: pausesOf(f).map(p => (p.end ? p : { ...p, end: now })) }); } },
    'switch-side': b => { const f = state.records.get(b.dataset.id); if (!f || f.end || f.side === 'both') return; const to = other(f.side); save({ ...f, side: to, switches: [...switchesOf(f), { at: new Date().toISOString(), to }] }); },
    'add-feed': () => feedDialog(null),
    'edit-feed': b => feedDialog(state.records.get(b.dataset.id)),
    vitamin() { const v = vitaminToday(); return v ? save({ id: v.id, deleted: true }) : save({ type: 'care', kind: 'vitamin', name: 'Vitamin D', dose: '', at: new Date().toISOString(), note: '' }); },
    'add-care': () => careDialog(null),
    'edit-care': b => careDialog(state.records.get(b.dataset.id)),
    'add-appointment': () => appointmentDialog(null),
    'edit-appointment': b => appointmentDialog(state.records.get(b.dataset.id)),
    'toggle-appointment': b => { const a = state.records.get(b.dataset.id); if (a) save({ ...a, done: !a.done }); },
    'add-journal': () => journalDialog(null),
    'edit-journal': b => journalDialog(state.records.get(b.dataset.id)),
    'share-journal': b => { const e = state.records.get(b.dataset.id); if (e) newsDialog(null, { on: e.on, title: { en: e.title }, text: { en: e.text }, photos: [...(e.photos || [])] }); },
    'add-news': () => newsDialog(null),
    'edit-news': b => newsDialog(state.records.get(b.dataset.id)),
    async react(b) {
      const mine = b.getAttribute('aria-pressed') === 'true';
      try {
        const { record } = await post('/api/react', { news: b.dataset.id, emoji: b.dataset.emoji, device, on: !mine });
        state.records.set(record.id, record); render();
      } catch (error) { toast(error.message); }
    },
    async 'family-link'() {
      let url;
      try { ({ url } = await api('/api/family-link')); } catch (error) { toast(error.message); return; }
      // Firefox on Android keeps a dismissed share request pending and shows it again
      // when a date or time picker closes, so there the link is copied instead.
      const ua = navigator.userAgent, stickyShare = /Android/.test(ua) && /Firefox\//.test(ua);
      if (navigator.share && !stickyShare) { try { await navigator.share({ title: NAME, text: `News of ${NAME}`, url }); return; } catch (error) { if (error.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); toast('The family link is copied.'); } catch { window.prompt('Copy the family link:', url); }
    },
    async 'push-on'() {
      if (push.busy) return;
      push.busy = true; push.error = ''; render();
      try {
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in the phone settings, then try again.');
        const reg = await navigator.serviceWorker.ready;
        push.sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(push.key) });
        const r = await post('/api/push/subscribe', { subscription: push.sub.toJSON(), settings: push.settings || push.defaults });
        push.id = r.id; push.settings = r.settings; store.set('maia-push-id', r.id);
        toast('Reminders are on for this phone.');
      } catch (error) { push.error = error.message; }
      push.busy = false; render();
    },
    async 'push-off'() {
      try { if (push.sub) { await post('/api/push/unsubscribe', { endpoint: push.sub.endpoint }); await push.sub.unsubscribe(); } } catch { /* the server forgot it either way */ }
      push.sub = null; push.id = null; push.settings = null; store.set('maia-push-id', '');
      render();
    },
  };
  app.addEventListener('change', event => {
    const form = event.target.closest('[data-form="reminders"]');
    if (!form) return;
    pushSettings({ vitamin: form.vitamin.checked, vitaminAt: form.vitaminAt.value || '10:00', appointments: form.appointments.checked, longFeed: form.longFeed.checked, noFeed: form.noFeed.checked, journal: form.journal.checked });
  });
  app.addEventListener('click', event => {
    const b = event.target.closest('[data-action]');
    if (!b || !actions[b.dataset.action]) return;
    event.preventDefault();
    Promise.resolve(actions[b.dataset.action](b)).catch(() => {});
  });
  app.addEventListener('submit', async event => {
    const form = event.target.closest('[data-form="login"]');
    if (!form) return;
    event.preventDefault();
    const password = form.password.value;
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      const { role } = await post('/api/login', { password });
      state.role = role; state.gateError = '';
      await loadRecords(); connect(); render(); pushInit();
    } catch (error) {
      state.gateError = /wrong/i.test(error.message) ? I.t(state.lang, 'wrong') : /many/i.test(error.message) ? I.t(state.lang, 'tooMany') : /off|locked/i.test(error.message) ? I.t(state.lang, 'off') : error.message;
      render();
      const input = app.querySelector('input[name=password]'); if (input) input.focus();
    }
  });
  // A tooltip for chart marks: hover with a mouse, tap on a phone.
  const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  let tipFor = null;
  const showTip = (el, x, y) => {
    tipFor = el; tip.textContent = el.dataset.tip; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.min(Math.max(8, x - w / 2), innerWidth - w - 8)}px`;
    tip.style.top = `${y - h - 14 < 8 ? y + 18 : y - h - 14}px`;
    document.querySelectorAll('.tipped').forEach(m => m.classList.remove('tipped')); el.classList.add('tipped');
  };
  const hideTip = () => { tip.hidden = true; tipFor = null; document.querySelectorAll('.tipped').forEach(m => m.classList.remove('tipped')); };
  app.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('[data-tip]'); if (el) showTip(el, e.clientX, e.clientY); else if (tipFor) hideTip(); });
  app.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideTip(); }); // a finger lifting also leaves
  app.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') return; const el = e.target.closest('[data-tip]'); if (el && el !== tipFor) showTip(el, e.clientX, e.clientY); else hideTip(); });
  window.addEventListener('scroll', () => { if (tipFor) hideTip(); }, { passive: true });
  app.addEventListener('scroll', e => { const g = e.target.classList && e.target.classList.contains('slides') && e.target.closest('[data-gallery]'); if (g) galleryMark(g); }, { capture: true, passive: true });
  window.addEventListener('hashchange', render);
  window.MaiaApp = { state, render, save, feeds, feedMs, activeSpans, sidedSpans, running, journal, news, cares, appointments, elapsed, duration, ago, push };
  boot();
})();
