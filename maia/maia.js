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

  const state = { role: null, facts: null, records: new Map(), lang: store.get('maia-lang') || I.guess(), gateError: '', socket: null, ticker: null };
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
  const feedMs = f => new Date(f.end || Date.now()) - new Date(f.start);
  const cares = () => all('care').sort((a, b) => new Date(b.at) - new Date(a.at));
  const vitaminToday = () => cares().find(c => c.kind === 'vitamin' && localDay(c.at) === today()) || null;
  const appointments = () => all('appointment').sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  const nextAppointment = () => appointments().find(a => !a.done && a.at && new Date(a.at) >= new Date(Date.now() - 3600000)) || null;
  const journal = () => all('journal').sort((a, b) => b.on.localeCompare(a.on) || b.rev - a.rev);
  const news = () => all('news').sort((a, b) => b.on.localeCompare(a.on) || b.rev - a.rev);
  const photosOf = rec => (rec.photos || []).map(id => state.records.get(id)).filter(p => p && !p.deleted);
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
    const { records } = await api('/api/records');
    state.records = new Map(records.map(r => [r.id, r]));
  }
  function connect() {
    if (state.socket || typeof io === 'undefined') return;
    state.socket = io('/maia', { withCredentials: true });
    state.socket.on('maia:record', rec => { const have = state.records.get(rec.id); if (!have || have.rev < rec.rev) { state.records.set(rec.id, rec); render(); } });
    state.socket.on('connect', () => { if (state.role) loadRecords().then(render).catch(() => {}); });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.role) loadRecords().then(render).catch(() => {}); });

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
    document.documentElement.lang = state.role === 'parents' ? 'en' : (state.lang === 'zh' ? 'zh-Hant' : state.lang);
    if (!state.role) app.innerHTML = gate();
    else if (state.role === 'family') app.innerHTML = familyPage();
    else app.innerHTML = parentsPage();
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

  function familyPage() {
    const L = state.lang, posts = news();
    return `<div class="topbar">${themeButton()}<button class="btn btn-ghost" type="button" data-action="logout" aria-label="${esc(I.t(L, 'signOut'))}" title="${esc(I.t(L, 'signOut'))}">${A.icon('leave')}</button></div>
      ${masthead(L)}${langSwitch()}
      <p class="note" style="text-align:center">${esc(I.t(L, 'familyWelcome'))}</p>
      <h2>${esc(I.t(L, 'news'))}</h2>
      ${posts.length ? posts.map(p => newsPost(p, L)).join('') : `${A.nest()}<p class="empty">${esc(I.t(L, 'noNews'))}</p>`}`;
  }
  const newsPost = (p, L) => `<article class="card entry" lang="${L === 'zh' ? 'zh-Hant' : L}">
    <div class="date">${esc(I.dateLong(L, new Date(p.on + 'T12:00:00')))}</div>
    <h3>${esc(I.pick(p.title, L) || I.t(L, 'untitled'))}</h3>
    <div class="text">${esc(I.pick(p.text, L))}</div>
    ${photoGrid(photosOf(p), I.t(L, 'photoAlt'))}
  </article>`;
  const photoGrid = (photos, alt) => photos.length ? `<div class="photos${photos.length === 1 ? ' single' : ''}">${photos.map(p => `<a href="/photos/${p.id}" target="_blank" rel="noopener"><img src="/photos/${p.id}" alt="${esc(alt)}" loading="lazy" width="${p.w || ''}" height="${p.h || ''}"></a>`).join('')}</div>` : '';

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
      <div class="card-head"><h2 id="feed-now" style="margin:0">${run ? `Feeding, ${run.side}` : 'Feeding'}</h2>${run ? `<span class="pill">since ${fmtTime(run.start)}</span>` : ''}</div>
      ${run ? `<div class="timer" data-elapsed="${esc(run.start)}">${elapsed(feedMs(run))}<small>${run.side === 'both' ? 'both sides' : `${run.side} side`}</small></div>
        <div class="row"><button class="btn btn-big btn-bark" type="button" data-action="stop-feed" data-id="${run.id}">${A.icon('stop')}Stop</button></div>
        <div class="row" style="margin-top:8px"><button class="btn" type="button" data-action="edit-feed" data-id="${run.id}">${A.icon('pen')}Fix the start or add a note</button></div>`
      : `<p class="note">${last ? `Last feed ${ago(last.end)}: ${last.side}, ${duration(feedMs(last))}. Next, ${suggest}.` : 'No feed logged yet. Tap a side when she starts.'}</p>
        <div class="row"><button class="btn btn-big ${suggest === 'left' ? 'btn-primary' : ''}" type="button" data-action="start-feed" data-side="left">${A.icon('left')}Left</button><button class="btn btn-big ${suggest === 'right' ? 'btn-primary' : ''}" type="button" data-action="start-feed" data-side="right">${A.icon('right')}Right</button></div>
        <div class="row" style="margin-top:8px"><button class="btn" type="button" data-action="start-feed" data-side="both">${A.icon('both')}Both sides</button><button class="btn" type="button" data-action="add-feed">${A.icon('plus')}A past feed</button></div>`}
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
        ${line('noFeed', 'No feed for 3 hours, then every 39 minutes')}
        ${line('journal', 'A new page in the journal, written on the other phone')}
      </form>
      <div class="row" style="margin-top:8px"><button class="btn btn-ghost" type="button" data-action="push-off">${A.icon('bell-off')}Turn off on this phone</button></div></section>`;
  }

  function feedsView() {
    const groups = groupByDay(feeds(), 'start');
    return `<h2>Feeds</h2><div class="row"><button class="btn" type="button" data-action="add-feed">${A.icon('plus')}Add a past feed</button></div>
      ${groups.size ? [...groups].map(([day, list]) => `<div class="day-head"><span>${fmtDay(day)}</span><small>${list.length} feed${list.length > 1 ? 's' : ''}, ${duration(list.reduce((s, f) => s + feedMs(f), 0))}</small></div>
        <ul class="list card" style="padding:4px 16px">${list.map(f => `<li><button class="rowbtn" type="button" data-action="edit-feed" data-id="${f.id}" aria-label="Edit the ${f.side} feed at ${fmtTime(f.start)}">${A.icon(f.side)}<span class="when">${fmtTime(f.start)}</span><span class="what">${f.side}${f.note ? `<small>${esc(f.note)}</small>` : ''}</span><span class="amount" ${f.end ? '' : `data-elapsed="${esc(f.start)}"`}>${f.end ? duration(feedMs(f)) : elapsed(feedMs(f))}</span></button></li>`).join('')}</ul>`).join('')
      : `${A.nest()}<p class="empty">Nothing logged yet.</p>`}`;
  }

  function journalView() {
    const entries = journal();
    return `<h2>Journal</h2><div class="row"><button class="btn btn-primary" type="button" data-action="add-journal">${A.icon('pen')}Write today</button></div>
      ${entries.length ? entries.map(e => `<article class="card entry"><div class="date">${fmtDay(e.on)}</div>${e.title ? `<h3>${esc(e.title)}</h3>` : ''}
        ${(e.weight || e.height || e.head) ? `<div class="measures">${e.weight ? `<span>${I.number('en', e.weight / 1000, 3)} kg</span>` : ''}${e.height ? `<span>${e.height} cm</span>` : ''}${e.head ? `<span>head ${e.head} cm</span>` : ''}</div>` : ''}
        <div class="text">${esc(e.text)}</div>${photoGrid(photosOf(e), NAME)}
        <div class="entry-actions"><button class="btn" type="button" data-action="edit-journal" data-id="${e.id}">${A.icon('pen')}Edit</button><button class="btn" type="button" data-action="share-journal" data-id="${e.id}">${A.icon('news')}Tell the family</button></div></article>`).join('')
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
      ${posts.length ? posts.map(p => `<article class="card entry"><div class="date">${fmtDay(p.on)} · ${I.LANGS.filter(l => p.title[l] || p.text[l]).map(l => l.toUpperCase()).join(' ') || 'empty'}</div><h3>${esc(I.pick(p.title, 'en') || 'Untitled')}</h3><div class="text">${esc(I.pick(p.text, 'en'))}</div>${photoGrid(photosOf(p), NAME)}
        <div class="entry-actions"><button class="btn" type="button" data-action="edit-news" data-id="${p.id}">${A.icon('pen')}Edit</button></div></article>`).join('') : `${A.nest()}<p class="empty">Nothing told yet.</p>`}`;
  }

  // ---- the clock on a running feed -------------------------------------------
  function tick() {
    clearInterval(state.ticker);
    const update = () => { for (const el of document.querySelectorAll('[data-elapsed]')) { const text = elapsed(Date.now() - new Date(el.dataset.elapsed)); const small = el.querySelector('small'); if (small) el.firstChild.nodeValue = text; else el.textContent = text; } };
    if (document.querySelector('[data-elapsed]') && !matchMedia('(prefers-reduced-motion: reduce)').matches) state.ticker = setInterval(update, 1000);
    else if (document.querySelector('[data-elapsed]')) state.ticker = setInterval(update, 15000);
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
      body: `${select('Side', 'side', [['left', 'Left'], ['right', 'Right'], ['both', 'Both sides']], rec.side)}<div class="fields-2">${field('Started', 'start', 'datetime-local', toInput(rec.start), 'required')}${field('Ended', 'end', 'datetime-local', rec.end ? toInput(rec.end) : '', rec.end ? '' : 'placeholder="still going"')}</div>${area('Note', 'note', rec.note, 'rows="2"')}`,
      onSubmit: d => save({ ...rec, type: 'feed', side: d.side, start: fromInput(d.start), end: fromInput(d.end), note: d.note.trim() }),
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
    const draw = () => {
      const attached = ids.map(id => state.records.get(id)).filter(Boolean);
      const others = reuse ? all('photo').sort((a, b) => b.rev - a.rev).filter(p => !ids.includes(p.id)).slice(0, 12) : [];
      strip.innerHTML = `${attached.length ? `<div class="photos">${attached.map(p => `<button class="thumb" type="button" data-detach="${p.id}" aria-label="Remove this photo" aria-pressed="true"><img src="/photos/${p.id}" alt=""></button>`).join('')}</div>` : '<p class="note">No photo attached.</p>'}
        ${others.length ? `<p class="note" style="margin-top:8px">Tap a recent photo to attach it:</p><div class="photos">${others.map(p => `<button class="thumb" type="button" data-attach="${p.id}" aria-label="Attach this photo"><img src="/photos/${p.id}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`;
    };
    strip.addEventListener('click', event => { const b = event.target.closest('[data-detach],[data-attach]'); if (!b) return; if (b.dataset.detach) ids.splice(ids.indexOf(b.dataset.detach), 1); else ids.push(b.dataset.attach); draw(); });
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
  const photoField = () => `<div class="field"><span>Photos</span><div data-strip></div><label class="btn" style="margin-top:8px">${A.icon('photo')}Add photos<input type="file" accept="image/*" multiple class="visually-hidden"></label></div>`;

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
    photoStrip(dlg, ids, { audience: 'family', reuse: true });
  }

  // ---- actions --------------------------------------------------------------
  const actions = {
    theme() { const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night'; document.documentElement.dataset.theme = next; store.set('maia-theme', next); },
    lang(b) { state.lang = b.dataset.lang; store.set('maia-lang', state.lang); render(); },
    async logout() { try { await post('/api/logout', {}); } catch { /* the cookie goes anyway */ } if (state.socket) { state.socket.disconnect(); state.socket = null; } state.role = null; state.records = new Map(); state.gateError = ''; location.hash = ''; render(); },
    'start-feed': b => save({ type: 'feed', side: b.dataset.side, start: new Date().toISOString(), end: null, note: '' }),
    'stop-feed': b => { const f = state.records.get(b.dataset.id); if (f) save({ ...f, end: new Date().toISOString() }); },
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
  window.addEventListener('hashchange', render);
  window.MaiaApp = { state, render, save, feeds, running, journal, news, cares, appointments, elapsed, duration, ago, push };
  boot();
})();
