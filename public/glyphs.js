'use strict';

// Glyphs: the duel. Rules live in glyphs-spells.js and the recogniser in
// glyphs-recognizer.js; this file owns the sheet, the clock, the monster's
// turn, and what the arena shows of each round.
(() => {
  const S = window.GlyphsSpells, R = window.GlyphsRecognizer;
  const sheet = document.getElementById('sheet');
  if (!sheet || !S || !R) return;
  const ctx = sheet.getContext('2d');
  const el = id => document.getElementById(id);
  const frame = el('sheet-frame'), sheetState = el('sheet-state'), castButton = el('cast'), clearButton = el('clear');
  const narration = el('narration'), hint = el('hint'), roundLabel = el('round'), timerBox = el('timer'), timerSeconds = el('timer-seconds');
  const timerRing = timerBox.querySelector('.timer-ring'), ringLength = 2 * Math.PI * 20;
  const stage = el('stage'), stageArt = stage.querySelector('.stage-art'), stageName = el('stage-name');
  const casters = { you: el('caster-you'), foe: el('caster-foe') };
  const quill = el('quill'), duelEnd = el('duel-end'), againButton = el('again'), beginButton = el('begin'), friendButton = el('friend');
  const actions = el('arena-actions'), online = el('online'), onlineStatus = el('online-status'), onlineHost = el('online-host'), onlineCode = el('online-code'), onlineLink = el('online-link'), onlineInput = el('online-input'), endNote = el('duel-end-note');
  const table = document.querySelector('.duel');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const monster = S.monsters[0];
  const monsterName = monster.name.replace(/^the /, 'The ');
  // 'monster' plays the Salamander here; 'online' lets the server run a duel
  // between two phones, with this page as side 0 of its own perspective.
  const net = { mode: 'monster', socket: null, code: null };
  // The table shows one scene at a time; a change takes this long to settle.
  const sceneDelay = () => reducedMotion.matches ? 0 : 580;
  const showScene = name => { table.dataset.scene = name; };
  el('foe-name').textContent = monsterName;

  const templates = S.spells.flatMap(spell => spell.variants.map(strokes => ({ id: spell.id, strokes })));
  const prepared = R.prepare(templates);
  const MIN_EXTENT = .12; // of the sheet, below which a drawing is a smudge
  const STIR_SCORE = .18;
  const INK = '#1f3329';

  const state = { round: 0, phase: 'ready', you: S.emptyBody(), foe: S.emptyBody(), history: [], strokes: [], strokesCast: [], locked: null, foeSpell: null, roundStart: 0, timer: 0, streaks: { you: null, foe: null } };

  // Drawing on the sheet. Coordinates are kept in sheet units (0..600).
  let drawing = false, scale = 1;
  const resize = () => { scale = sheet.width / sheet.getBoundingClientRect().width; };
  const pointFor = event => {
    const box = sheet.getBoundingClientRect();
    return [(event.clientX - box.left) * scale, (event.clientY - box.top) * scale];
  };
  const paintSheet = () => {
    ctx.clearRect(0, 0, sheet.width, sheet.height);
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    for (const stroke of state.strokes) {
      if (stroke.length < 2) { ctx.beginPath(); ctx.arc(stroke[0][0], stroke[0][1], 3.5, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0], stroke[i][1]);
      ctx.stroke();
    }
  };
  const canDraw = () => state.phase === 'drawing' && !state.locked;
  sheet.addEventListener('pointerdown', event => {
    if (!canDraw() || event.button > 0) return;
    event.preventDefault();
    resize();
    sheet.setPointerCapture(event.pointerId);
    drawing = true;
    state.strokes.push([pointFor(event)]);
    paintSheet();
  });
  sheet.addEventListener('pointermove', event => {
    if (!drawing || !canDraw()) return;
    const stroke = state.strokes[state.strokes.length - 1], p = pointFor(event), last = stroke[stroke.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
    stroke.push(p);
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
  });
  const endStroke = event => {
    if (!drawing) return;
    drawing = false;
    try { sheet.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    paintSheet();
    resonate();
  };
  sheet.addEventListener('pointerup', endStroke);
  sheet.addEventListener('pointercancel', endStroke);
  sheet.addEventListener('contextmenu', event => event.preventDefault());

  // Reading the sheet: what the ink would be if cast now.
  const readSheet = () => {
    const strokes = state.strokes.filter(s => s.length > 1);
    if (!strokes.length) return { id: 'rest', candidates: [] };
    if (R.extent(strokes) < MIN_EXTENT * sheet.width) return { id: 'fizzle', candidates: [] };
    const candidates = R.recognize(strokes, prepared);
    const best = candidates[0];
    return { id: best && best.distance <= R.ACCEPT ? best.id : 'fizzle', candidates };
  };
  const showSheetState = text => {
    sheetState.textContent = text;
    sheetState.classList.toggle('is-visible', Boolean(text));
  };
  // The glow tells the caster how near the ink is to a glyph, never which.
  const resonate = () => {
    const reading = readSheet();
    const best = reading.candidates[0];
    const glow = best ? Math.max(0, Math.min(1, (R.ACCEPT * 1.6 - best.distance) / (R.ACCEPT * 1.6))) : 0;
    frame.style.setProperty('--glow', reading.id === 'fizzle' ? glow.toFixed(2) : '0');
    frame.classList.toggle('is-set', reading.id !== 'rest' && reading.id !== 'fizzle');
    if (reading.id === 'rest') showSheetState('');
    else if (reading.id === 'fizzle') showSheetState(best && best.score > STIR_SCORE ? 'the ink stirs' : 'the ink lies flat');
    else showSheetState('the ink sets');
  };

  // Marks and portraits.
  const MARK_SLOTS = { fire: [[-44, 6], [-50, 28], [-40, 48]], water: [[44, 6], [50, 28], [40, 48]], earth: [[-18, 60], [0, 64], [18, 60]], air: [[-30, -56], [0, -66], [30, -56]] };
  const bodyLine = body => {
    const parts = S.ELEMENTS.filter(e => body[e]).map(e => `${body[e]} ${S.MARK_NAMES[e]}${body[e] > 1 ? 's' : ''}`);
    return parts.length ? parts.join(', ') : 'unmarked';
  };
  const paintBody = (side, body, death) => {
    const figure = casters[side], marks = figure.querySelector('[data-marks]');
    marks.innerHTML = S.ELEMENTS.flatMap(e => MARK_SLOTS[e].slice(0, Math.min(body[e], S.DEATH_AT)).map(([x, y]) => `<use href="#g-mark-${e}" transform="translate(${x} ${y}) scale(1.3)"/>`)).join('');
    figure.querySelector('[data-state]').textContent = death ? S.DEATHS[death].name : bodyLine(body);
    figure.classList.toggle('is-dead', Boolean(death));
    if (death) figure.dataset.death = death; else delete figure.dataset.death;
  };

  // The stage: each side's casting arrives as a token, and the reaction blooms between them.
  const tokenFor = id => {
    const spell = S.byId[id];
    return `#g-token-${spell.elements.length === 1 ? spell.elements[0] : id}`;
  };
  const BURSTS = {
    inferno: '<path d="M-26 20C-30-4-12-18 0-34C12-18 30-4 26 20C20 32-20 32-26 20Z" fill="url(#g-ember)" opacity=".9"/>',
    steam: '<path d="M-34 10C-40-10-14-22 0-12C14-22 40-10 34 10C40 24 10 30 0 22C-10 30-40 24-34 10Z" fill="#dfe6e2" opacity=".8"/>',
    lava: '<path d="M-36 14C-30-8-10-16 0-8C10-16 30-8 36 14C26 30-26 30-36 14Z" fill="url(#g-ember)"/><path d="M-20 18C-10 8 10 8 20 18" stroke="#2b1810" stroke-width="3" fill="none"/>',
    fanned: '<path d="M-38 0C-18-22 18-22 38 0M-30 12C-12-6 12-6 30 12" fill="none" stroke="url(#g-leaf)" stroke-width="4" stroke-linecap="round"/><path d="M0-24C8-12 14-4 14 4A14 14 0 0 1-14 4C-14-4-8-12 0-24Z" fill="url(#g-ember)"/>',
    held: '<circle r="30" fill="none" stroke="url(#g-brass)" stroke-width="5"/><circle r="22" fill="none" stroke="url(#g-brass)" stroke-width="1.5" opacity=".6"/>',
    reflected: '<path d="M-6-32H6V32H-6Z" fill="#cfd8d6" stroke="url(#g-brass)" stroke-width="2"/><path d="M-40 0H-14M14 0H40" stroke="url(#g-brass)" stroke-width="3" stroke-dasharray="6 5"/>',
    flood: '<path d="M-40-4C-28-18-14-18-2-4C10 10 24 10 40-4M-40 12C-28-2-14-2-2 12C10 26 24 26 40 12" fill="none" stroke="url(#g-drop)" stroke-width="5" stroke-linecap="round"/>',
    mud: '<path d="M-38 16C-30-4-10-12 0-6C10-12 30-4 38 16Z" fill="#5e4a2e"/><path d="M-26 6C-14-8 14-8 26 6" fill="none" stroke="#4f8aa3" stroke-width="3" opacity=".7"/>',
    rain: '<path d="M-30-10C-10-30 10-30 30-10" fill="none" stroke="url(#g-leaf)" stroke-width="4" stroke-linecap="round"/><path d="M-24 4V20M-8 8V26M8 4V20M24 8V26" stroke="url(#g-drop)" stroke-width="4" stroke-linecap="round"/>',
    'flows through': '<path d="M-6-28H6V28H-6Z" fill="#cfd8d6" stroke="url(#g-brass)" stroke-width="2"/><path d="M-40 0C-28-12-16-12-10 0C-4 12 4 12 10 0C16-12 28-12 40 0" fill="none" stroke="url(#g-drop)" stroke-width="4"/>',
    quake: '<path d="M-40 18H40M-30 10L-22 2L-14 12L-6-2L2 10L10 0L18 12L26 4L34 14" fill="none" stroke="url(#g-stone)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    pass: '<path d="M-16-14H14V16H-16Z" fill="url(#g-stone)"/><path d="M-40 6C-24-14 0-14 10 2C18 14 32 10 40-4" fill="none" stroke="url(#g-leaf)" stroke-width="4" stroke-linecap="round"/>',
    shatters: '<path d="M-6-30L6-30L8-6L-2 2L4 30L-6 30L-8 6L2-2Z" fill="#cfd8d6" stroke="url(#g-brass)" stroke-width="1.5"/><path d="M-30-8H-12V10H-30Z" fill="url(#g-stone)"/>',
    gale: '<path d="M-42 0C-22-26 2-26 22 0C30 10 36 10 42 0M-36 14C-16-8 4-8 24 14" fill="none" stroke="url(#g-leaf)" stroke-width="5" stroke-linecap="round"/>',
    stillness: '<circle r="24" fill="none" stroke="#6b705f" stroke-width="2" stroke-dasharray="4 5"/>',
    lands: '<path d="M-30-6L0 10L30-6" fill="none" stroke="url(#g-brass)" stroke-width="4" stroke-linecap="round"/>',
    quiet: '<path d="M-14 16C-14-4 0-4 0-16C0-4 14-4 14 16" fill="none" stroke="#6b705f" stroke-width="2" stroke-linecap="round"/>'
  };
  // Momentum shows as extra rings round the token.
  const rings = power => Array.from({ length: power - 1 }, (_, i) => `<circle r="${27 + i * 5}" fill="none" stroke="url(#g-brass)" stroke-width="1.5" opacity="${(.9 - i * .25).toFixed(2)}"/>`).join('');
  const paintStage = (yours, theirs, reaction, animate) => {
    stage.classList.remove('is-animating');
    // A compound reaction shows the bursts of its parts side by side.
    const parts = (reaction.parts || [reaction.name]).filter(name => BURSTS[name]).slice(0, 4);
    const spread = parts.length > 1 ? 44 : 0, size = parts.length > 2 ? .55 : parts.length > 1 ? .7 : 1;
    const bursts = parts.map((name, i) => `<g transform="translate(${((i - (parts.length - 1) / 2) * spread).toFixed(1)} 0) scale(${size})">${BURSTS[name]}</g>`).join('');
    stageArt.innerHTML = `<g class="stage-token" data-token="you" transform="translate(${animate ? -130 : -92} 0)">${rings(reaction.powers[0])}<use href="${tokenFor(yours)}"/></g><g class="stage-token" data-token="foe" transform="translate(${animate ? 130 : 92} 0)">${rings(reaction.powers[1])}<use href="${tokenFor(theirs)}"/></g><g class="stage-burst" transform="translate(0 0)">${bursts}</g>`;
    stageName.textContent = reaction.name;
    if (animate) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        stageArt.querySelector('[data-token="you"]').setAttribute('transform', 'translate(-92 0)');
        stageArt.querySelector('[data-token="foe"]').setAttribute('transform', 'translate(92 0)');
        stage.classList.add('is-animating');
      }));
    }
  };
  const clearStage = () => { stageArt.innerHTML = ''; stageName.textContent = ''; stage.classList.remove('is-animating'); };

  // The grimoire keeps the glyphs this caster has made work, in their own hand.
  const GRIMOIRE_KEY = 'glyphs-grimoire';
  const loadGrimoire = () => { try { return JSON.parse(localStorage.getItem(GRIMOIRE_KEY)) || {}; } catch { return {}; } };
  const saveGrimoire = grimoire => { try { localStorage.setItem(GRIMOIRE_KEY, JSON.stringify(grimoire)); } catch { /* the page still plays without memory */ } };
  const thumbnail = strokes => `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="${strokes.map(s => 'M' + s.map(p => p.map(v => (v * 100).toFixed(1)).join(' ')).join('L')).join('')}"/></svg>`;
  const renderGrimoire = () => {
    const grimoire = loadGrimoire();
    const entries = S.spells.filter(spell => grimoire[spell.id]);
    el('grimoire-note').hidden = entries.length > 0;
    el('grimoire-list').innerHTML = entries.map(spell => `<li>${thumbnail(grimoire[spell.id].strokes)}<div><strong>${spell.name}</strong><small>${spell.element ? spell.element : spell.kind}</small></div></li>`).join('');
  };
  const recordGlyph = (id, strokes) => {
    const grimoire = loadGrimoire();
    if (grimoire[id]) return;
    // Fit the drawing into a unit box so the thumbnail is the player's hand, not the sheet.
    const pts = strokes.flat();
    const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
    const size = Math.max(Math.max(...pts.map(p => p[0])) - minX, Math.max(...pts.map(p => p[1])) - minY) || 1;
    const offX = (1 - (Math.max(...pts.map(p => p[0])) - minX) / size) / 2, offY = (1 - (Math.max(...pts.map(p => p[1])) - minY) / size) / 2;
    const fitted = strokes.map(s => s.filter((_, i) => i % 3 === 0 || i === s.length - 1).map(p => [+(offX + (p[0] - minX) / size * .84 + .08).toFixed(3), +(offY + (p[1] - minY) / size * .84 + .08).toFixed(3)]));
    grimoire[id] = { strokes: fitted, when: new Date().toISOString() };
    saveGrimoire(grimoire);
    renderGrimoire();
  };

  // What each caster took this round: badges by the portrait, a flash on the
  // figure, and a plain outcome line.
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const outcomeFor = (side, result, index, spellId) => {
    const marks = index === 0 ? result.reaction.marks.a : result.reaction.marks.b;
    const items = [];
    if (result.heals[index]) items.push({ kind: 'heal', text: `${S.MARK_NAMES[result.heals[index]]} fades` });
    for (const e of S.ELEMENTS) if (marks[e]) items.push({ kind: e, text: `+${plural(marks[e], S.MARK_NAMES[e])}` });
    for (const c of result.cancellations[index]) items.push({ kind: 'heal', text: `${c.name} clears ${c.count}` });
    if (result.deaths[index]) items.push({ kind: 'death', text: S.DEATHS[result.deaths[index]].name });
    if (!items.length) items.push({ kind: 'none', text: spellId === 'rest' ? 'rests' : 'untouched' });
    return items;
  };
  const showHits = (side, items) => {
    const figure = casters[side], list = figure.querySelector('[data-hits]');
    list.innerHTML = items.map((item, i) => `<li data-kind="${item.kind}" style="animation-delay:${i * 180}ms">${item.text}</li>`).join('');
    figure.classList.remove('is-hit', 'is-healed');
    void figure.offsetWidth;
    if (items.some(item => S.ELEMENTS.includes(item.kind))) figure.classList.add('is-hit');
    else if (items.some(item => item.kind === 'heal')) figure.classList.add('is-healed');
  };
  const clearHits = () => Object.values(casters).forEach(figure => { figure.querySelector('[data-hits]').innerHTML = ''; figure.classList.remove('is-hit', 'is-healed'); });
  // Narration, for the eye and the screen reader.
  const narrate = html => { narration.innerHTML = html; };
  const outcomeLine = (name, items) => `<span data-kind="${items.some(i => S.ELEMENTS.includes(i.kind) || i.kind === 'death') ? 'hit' : items.some(i => i.kind === 'heal') ? 'heal' : 'none'}"><strong>${name}</strong> ${items.map(i => i.text).join(', ')}</span>`;
  const TIMES = ['', '', 'twice over', 'thrice over'];
  const yourCastLine = (id, heal, power) => {
    const spell = S.byId[id];
    if (id === 'rest') return heal ? `You rest; ${aMark(heal)} fades.` : 'You rest, and there was nothing to settle.';
    if (id === 'fizzle') return 'Your ink smoulders; it was no glyph.';
    return `You cast <em>${spell.name}</em>${power > 1 ? `, ${TIMES[power]}` : ''}.`;
  };
  const aMark = e => `${e === 'ember' || e === 'air' ? 'a' : 'a'} ${S.MARK_NAMES[e]}`;

  // The clock and the round.
  const setTimer = remaining => {
    const fraction = Math.max(0, remaining / S.ROUND_SECONDS);
    timerRing.style.strokeDashoffset = (ringLength * (1 - fraction)).toFixed(2);
    timerSeconds.textContent = Math.ceil(Math.max(0, remaining));
    timerBox.classList.toggle('is-late', remaining <= 3);
  };
  const setQuill = mode => { if (mode) quill.dataset.quill = mode; else delete quill.dataset.quill; };
  const clearSheet = () => { state.strokes = []; paintSheet(); resonate(); };
  // A round opens the same way whoever the opponent is; only who resolves it differs.
  const openRound = (round, seconds = S.ROUND_SECONDS) => {
    state.round = round;
    state.phase = 'drawing';
    state.locked = null;
    clearHits();
    showScene('sheet');
    state.roundStart = performance.now() + sceneDelay();
    roundLabel.textContent = `Round ${state.round}`;
    frame.classList.remove('is-locked');
    castButton.disabled = false; clearButton.disabled = false;
    setQuill('scratching');
    clearSheet();
    setTimer(seconds);
    cancelAnimationFrame(state.timer);
    const tick = () => {
      if (state.phase !== 'drawing') return;
      const elapsed = Math.max(0, performance.now() - state.roundStart) / 1000;
      setTimer(seconds - elapsed);
      if (elapsed >= seconds) { timeOut(); return; }
      state.timer = requestAnimationFrame(tick);
    };
    state.timer = requestAnimationFrame(tick);
  };
  const startRound = () => {
    state.foeSpell = S.chooseSpell(monster, state.foe, state.you, state.history, Math.random, { self: state.streaks.foe, other: state.streaks.you });
    openRound(state.round + 1);
  };
  const sealSheet = () => {
    drawing = false;
    state.locked = readSheet().id;
    state.strokesCast = state.strokes.filter(s => s.length > 1);
    frame.classList.add('is-locked');
    castButton.disabled = true; clearButton.disabled = true;
  };
  // The clock ran out: the sheet is read as it stands.
  const timeOut = () => {
    if (net.mode === 'online') {
      if (!state.locked) { sealSheet(); sendCast(); }
      return;
    }
    resolveRound();
  };
  const lockSpell = () => {
    if (state.phase !== 'drawing' || state.locked) return;
    sealSheet();
    if (net.mode === 'online') {
      showSheetState(state.locked === 'rest' ? 'you rest · waiting for the other caster' : 'cast · waiting for the other caster');
      sendCast();
      return;
    }
    showSheetState(state.locked === 'rest' ? 'you rest' : 'cast');
    // Casting seals both sheets: the monster answers at once.
    resolveRound();
  };
  const sendCast = () => {
    state.phase = 'locked';
    cancelAnimationFrame(state.timer);
    if (net.socket) net.socket.emit('glyphs:cast', state.locked);
  };
  // Against the monster the page runs the rules itself.
  const resolveRound = () => {
    state.phase = 'resolving';
    cancelAnimationFrame(state.timer);
    if (!state.locked) sealSheet();
    const yours = state.locked, theirs = state.foeSpell;
    state.streaks.you = S.nextStreak(state.streaks.you, yours);
    state.streaks.foe = S.nextStreak(state.streaks.foe, theirs);
    const powers = [S.powerOf(state.streaks.you), S.powerOf(state.streaks.foe)];
    const result = S.applyRound(state.you, state.foe, yours, theirs, powers);
    presentRound(yours, theirs, powers, result, () => { state.phase = 'between'; window.setTimeout(startRound, reducedMotion.matches ? 1600 : 3400); });
  };
  // Both opponents end here: the sheet is sent, the battlefield comes up, the
  // spells meet, and what each caster took is shown.
  const presentRound = (yours, theirs, powers, result, next) => {
    state.phase = 'resolving';
    cancelAnimationFrame(state.timer);
    castButton.disabled = true; clearButton.disabled = true;
    frame.classList.add('is-locked');
    setQuill('sealed');
    setTimer(0);
    state.you = result.bodies[0]; state.foe = result.bodies[1];
    state.history.push(yours);
    if (yours !== 'rest' && yours !== 'fizzle') recordGlyph(yours, state.strokesCast);
    const animate = !reducedMotion.matches;
    const foeName = el('foe-name').textContent;
    const yourItems = outcomeFor('you', result, 0, yours), foeItems = outcomeFor('foe', result, 1, theirs);
    const story = `<p>Round ${state.round}. ${yourCastLine(yours, result.heals[0], powers[0])}</p><p class="narration-reaction"><strong>${result.reaction.name}</strong>${result.reaction.line}</p><p class="narration-outcomes">${outcomeLine('You', yourItems)}${outcomeLine(foeName, foeItems)}</p>`;
    const [youDead, foeDead] = result.deaths;
    showScene('arena');
    window.setTimeout(() => paintStage(yours, theirs, result.reaction, animate), sceneDelay());
    window.setTimeout(() => {
      paintBody('you', state.you, youDead);
      paintBody('foe', state.foe, foeDead);
      showHits('you', yourItems);
      showHits('foe', foeItems);
      narrate(story + (youDead && foeDead ? '<p>Both fall in the same breath.</p>' : ''));
      if (youDead || foeDead) {
        window.setTimeout(() => endDuel(youDead, foeDead), animate ? 1400 : 0);
        return;
      }
      next();
    }, sceneDelay() + (animate ? 900 : 0));
  };
  const endDuel = (youDead, foeDead) => {
    state.phase = 'ended';
    const title = youDead && foeDead ? 'Both fall' : youDead ? 'You are ' + S.DEATHS[youDead].name : 'The duel is yours';
    const line = youDead && foeDead ? `${S.DEATHS[youDead].line} ${S.DEATHS[foeDead].line}` : S.DEATHS[youDead || foeDead].line;
    el('duel-end-title').textContent = title;
    el('duel-end-line').textContent = `${line} ${youDead && !foeDead ? '' : foeDead && !youDead ? `${el('foe-name').textContent} is ${S.DEATHS[foeDead].name} after ${state.round} round${state.round > 1 ? 's' : ''}.` : ''}`.trim();
    endNote.hidden = true;
    againButton.textContent = net.mode === 'online' ? 'Duel again at this table' : 'Duel again';
    duelEnd.hidden = false;
    againButton.focus();
  };
  // The table is set, but nothing moves until the player is ready.
  const startDuel = () => {
    cancelAnimationFrame(state.timer);
    state.round = 0; state.history = []; state.phase = 'ready';
    state.streaks = { you: null, foe: null };
    state.you = S.emptyBody(); state.foe = S.emptyBody();
    paintBody('you', state.you, null); paintBody('foe', state.foe, null);
    clearStage();
    clearHits();
    duelEnd.hidden = true;
    showScene('arena');
    state.strokes = []; paintSheet(); showSheetState('');
    frame.classList.remove('is-locked', 'is-set'); frame.style.setProperty('--glow', '0');
    castButton.disabled = true; clearButton.disabled = true;
    actions.hidden = false; beginButton.hidden = false;
    online.hidden = true;
    setQuill(null);
    setTimer(S.ROUND_SECONDS);
    roundLabel.textContent = 'Ready';
    if (net.mode === 'online') narrate('Both casters are at the table.');
    else narrate(`The candles are lit. ${monsterName} waits at the far end of the room. Begin when you are ready.`);
  };
  const beginDuel = () => {
    if (state.phase !== 'ready') return;
    actions.hidden = true;
    sheet.focus({ preventScroll: true });
    startRound();
  };

  // Duelling a friend. The socket.io client is only fetched when asked for.
  const loadSocket = () => new Promise((resolve, reject) => {
    if (window.io) return resolve(window.io);
    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.min.js';
    script.onload = () => resolve(window.io);
    script.onerror = () => reject(new Error('The duelling table could not be reached.'));
    document.head.append(script);
  });
  const setStatus = text => { onlineStatus.textContent = text; };
  const showOnline = () => { online.hidden = false; window.setTimeout(() => online.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' }), 50); };
  const leaveTable = () => {
    if (net.socket) { net.socket.emit('glyphs:leave'); net.socket.disconnect(); }
    net.socket = null; net.code = null; net.mode = 'monster';
    el('foe-name').textContent = monsterName;
    if (location.hash.startsWith('#duel=')) history.replaceState(null, '', location.pathname);
  };
  const connect = async () => {
    if (net.socket) return net.socket;
    const io = await loadSocket();
    const socket = io();
    net.socket = socket;
    socket.on('glyphs:start', () => {
      net.mode = 'online';
      el('foe-name').textContent = 'The other caster';
      startDuel();
      actions.hidden = true; online.hidden = true;
      narrate('Both casters are at the table. The first sheet comes in a moment.');
      state.phase = 'waiting';
    });
    socket.on('glyphs:round', ({ round, seconds }) => { duelEnd.hidden = true; openRound(round, seconds); });
    socket.on('glyphs:sealed', () => { if (state.phase === 'drawing' || state.phase === 'locked') setQuill('sealed'); });
    socket.on('glyphs:result', ({ round, yours, theirs, powers, result }) => {
      state.round = round;
      state.streaks.you = S.nextStreak(state.streaks.you, yours);
      state.streaks.foe = S.nextStreak(state.streaks.foe, theirs);
      if (!state.locked) sealSheet();
      presentRound(yours, theirs, powers, result, () => { state.phase = 'between'; });
    });
    socket.on('glyphs:again-asked', () => { endNote.hidden = false; endNote.textContent = 'The other caster is ready for another duel.'; });
    socket.on('glyphs:left', () => {
      leaveTable();
      startDuel();
      narrate('The other caster has left the table. The Salamander will fight you when you are ready.');
    });
    socket.on('disconnect', () => {
      if (net.mode !== 'online' && online.hidden) return;
      leaveTable();
      startDuel();
      narrate('The table was lost. The Salamander will fight you when you are ready.');
    });
    return socket;
  };
  const hostDuel = async () => {
    showOnline(); onlineHost.hidden = true;
    setStatus('Setting the table…');
    try {
      const socket = await connect();
      socket.emit('glyphs:create', ({ code }) => {
        net.code = code;
        onlineCode.textContent = code;
        onlineLink.href = `${location.origin}${location.pathname}#duel=${code}`;
        onlineHost.hidden = false;
        setStatus('Waiting for the other caster…');
      });
    } catch (error) { setStatus(error.message); }
  };
  const joinDuel = async code => {
    showOnline(); onlineHost.hidden = true;
    setStatus(`Joining ${code}…`);
    try {
      const socket = await connect();
      socket.emit('glyphs:join', code, reply => {
        if (reply.error) { setStatus(reply.error); return; }
        net.code = reply.code;
        setStatus('Found the table.');
      });
    } catch (error) { setStatus(error.message); }
  };
  friendButton.addEventListener('click', hostDuel);
  el('online-join').addEventListener('submit', event => {
    event.preventDefault();
    const code = onlineInput.value.trim().toUpperCase();
    if (code.length === 4) joinDuel(code);
  });
  el('online-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(onlineLink.href); setStatus('Link copied. Waiting for the other caster…'); } catch { setStatus('Copy the link by hand: ' + onlineLink.href); }
  });
  el('online-cancel').addEventListener('click', () => { leaveTable(); online.hidden = true; setStatus(''); });

  castButton.addEventListener('click', lockSpell);
  clearButton.addEventListener('click', () => { if (canDraw()) clearSheet(); });
  beginButton.addEventListener('click', beginDuel);
  againButton.addEventListener('click', () => {
    if (net.mode === 'online' && net.socket) {
      net.socket.emit('glyphs:again');
      againButton.blur();
      endNote.hidden = false; endNote.textContent = 'Waiting for the other caster to agree…';
      return;
    }
    startDuel(); beginDuel();
  });
  sheet.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); lockSpell(); }
    if (event.key === 'Escape' || event.key === 'Backspace') { event.preventDefault(); if (canDraw()) clearSheet(); }
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    // A hidden tab stops the clock; the round restarts on return so nobody is
    // ambushed by a round that ran out while they were away.
    if (net.mode === 'online') return;
    if (document.hidden && state.phase === 'drawing') { cancelAnimationFrame(state.timer); state.phase = 'paused'; }
    else if (!document.hidden && state.phase === 'paused') { state.round -= 1; startRound(); }
  });

  resize();
  renderGrimoire();
  startDuel();
  // A link with a code joins that table straight away.
  const invited = location.hash.match(/^#duel=([A-Za-z]{4})$/);
  if (invited) joinDuel(invited[1].toUpperCase());
  // Exposed for the browser check.
  window.glyphsDuel = { state, net, readSheet, lockSpell, startDuel, beginDuel, startRound, hostDuel, joinDuel, prepared, monster };
})();
