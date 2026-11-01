'use strict';

// Glyphs: the duel. Rules live in glyphs-spells.js and the recogniser in
// glyphs-recognizer.js; this file owns the sheet, the clock, the monster's
// turn, and what the arena shows of each round.
(() => {
  const S = window.GlyphsSpells, R = window.GlyphsRecognizer, M = window.GlyphsMotion;
  const sheet = document.getElementById('sheet');
  if (!sheet || !S || !R || !M) return;
  const ctx = sheet.getContext('2d');
  const el = id => document.getElementById(id);
  const frame = el('sheet-frame'), sheetState = el('sheet-state'), castButton = el('cast'), clearButton = el('clear');
  const narration = el('narration'), hint = el('hint'), roundLabel = el('round'), timerBox = el('timer'), timerSeconds = el('timer-seconds');
  const timerRing = timerBox.querySelector('.timer-ring'), ringLength = 2 * Math.PI * 20;
  const stage = el('stage'), stageArt = stage.querySelector('.stage-art'), stageName = el('stage-name');
  const casters = { you: el('caster-you'), foe: el('caster-foe') };
  const quill = el('quill'), duelEnd = el('duel-end'), againButton = el('again'), beginButton = el('begin'), friendButton = el('friend');
  const actions = el('arena-actions'), nextBox = el('arena-next'), nextButton = el('next'), nextNote = el('next-note'), online = el('online'), onlineStatus = el('online-status'), onlineHost = el('online-host'), onlineCode = el('online-code'), onlineLink = el('online-link'), onlineInput = el('online-input'), endNote = el('duel-end-note');
  const table = document.querySelector('.duel'), arena = document.querySelector('.arena'), arenaFlash = arena.querySelector('.arena-flash'), soundButton = el('sound');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // The motion layer lies over both scenes; elements from the forge get a
  // particle colour of their own.
  S.ELEMENTS.forEach(id => M.register(id, S.ELEMENT_COLOURS[id]));
  M.mount(document.querySelector('.scenes'));
  const monster = S.monsters[0];
  const monsterName = monster.name.replace(/^the /, 'The ');
  // 'monster' plays the Salamander here; 'online' lets the server run a duel
  // between two phones, with this page as side 0 of its own perspective.
  const net = { mode: 'monster', socket: null, code: null };
  // The table shows one scene at a time; a change takes this long to settle.
  const sceneDelay = () => reducedMotion.matches ? 0 : 580;
  // How long the spells take to cross the stage, and how long the reaction
  // blooms before the rings answer. Slow enough to be read.
  const TOKENS_MS = 1100, BLOOM_MS = 1300, HIT_MS = 650, HOLD_MS = 90;
  // Dust drifts through the candle light while the battlefield is in view.
  const showScene = name => { table.dataset.scene = name; M.ambient(name === 'arena', arena); };
  el('foe-name').textContent = monsterName;
  if (window.GlyphsWheel && el('elements-wheel')) {
    el('elements-wheel').innerHTML = window.GlyphsWheel.svg(S, { id: 'elements', size: 320 });
    if (el('elements-rules')) el('elements-rules').innerHTML = window.GlyphsWheel.rules(S);
  }

  const templates = S.spells.flatMap(spell => spell.variants.map(strokes => ({ id: spell.id, strokes })));
  const prepared = R.prepare(templates);
  const MIN_EXTENT = .12; // of the sheet, below which a drawing is a smudge
  const STIR_SCORE = .18;
  const INK = '#1f3329';
  // What the sheet says once a glyph is read, by the hand that drew it.
  const PRECISION = { 1: 'the ink sets', 2: 'the ink sets, clean', 3: 'the ink sets, perfect' };

  const state = { round: 0, phase: 'ready', you: S.emptyBody(), foe: S.emptyBody(), history: [], strokes: [], strokesCast: [], locked: null, power: 1, foeSpell: null, foePower: 1, known: null, roundStart: 0, timer: 0 };

  // Drawing on the sheet. Coordinates are kept in sheet units (0..600).
  let drawing = false, scale = 1;
  const resize = () => { scale = sheet.width / sheet.getBoundingClientRect().width; };
  const pointFor = event => {
    const box = sheet.getBoundingClientRect();
    return [(event.clientX - box.left) * scale, (event.clientY - box.top) * scale];
  };
  // The ink is drawn plain; at the seal it is drawn again over itself in
  // brass, with a glow that grows with `glow` (0 to 1).
  const paintSheet = (glow = 0) => {
    ctx.clearRect(0, 0, sheet.width, sheet.height);
    const inkStrokes = () => {
      for (const stroke of state.strokes) {
        if (stroke.length < 2) { ctx.beginPath(); ctx.arc(stroke[0][0], stroke[0][1], 3.5, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); continue; }
        ctx.beginPath(); ctx.moveTo(stroke[0][0], stroke[0][1]);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0], stroke[i][1]);
        ctx.stroke();
      }
    };
    ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    inkStrokes();
    if (glow > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(226, 190, 110, ${(glow * .9).toFixed(2)})`;
      ctx.shadowColor = `rgba(226, 190, 110, ${glow.toFixed(2)})`; ctx.shadowBlur = 22 * glow;
      ctx.lineWidth = 5;
      inkStrokes();
      ctx.restore();
    }
  };
  // The seal: the ink sets into brass and sparks lift off the lines.
  const sealInk = () => {
    if (reducedMotion.matches) return;
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / 420);
      paintSheet(t);
      if (t < 1 && state.locked) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const pts = state.strokesCast.flat().filter((_, i) => i % 5 === 0);
    for (const [px, py] of pts) {
      const [x, y] = M.at(sheet, px / sheet.width, py / sheet.height);
      M.burst(x, y, 'brass', 2, { speed: 70, angle: -Math.PI / 2, arc: .9, lifeScale: 1.2 });
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
    if (!strokes.length) return { id: 'blank', candidates: [], power: 1, ring: false };
    if (R.extent(strokes) < MIN_EXTENT * sheet.width) return { id: 'fizzle', candidates: [], power: 1, ring: false };
    // A glyph inside a circle is a ring of that element.
    const split = R.splitRing(strokes);
    const read = split.ring ? split.inner : strokes;
    const candidates = R.recognize(read, prepared);
    const best = candidates[0];
    const accepted = best && best.distance <= R.ACCEPT;
    if (!accepted) return { id: 'fizzle', candidates, power: 1, ring: Boolean(split.ring) };
    const power = S.powerFor(best.distance);
    if (split.ring) {
      if (S.byId[best.id].kind !== 'attack') return { id: best.id === 'ward' ? 'ward' : 'fizzle', candidates, power, ring: true };
      return { id: S.ringId(best.id), candidates, power, ring: true };
    }
    return { id: best.id, candidates, power, ring: false };
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
    const set = reading.id !== 'blank' && reading.id !== 'fizzle';
    if (set && !frame.classList.contains('is-set')) M.play('ink');
    frame.classList.toggle('is-set', set);
    if (reading.id === 'blank') showSheetState('');
    else if (reading.id === 'fizzle') showSheetState(best && best.score > STIR_SCORE ? 'the ink stirs' : 'the ink lies flat');
    else showSheetState(reading.ring ? `${PRECISION[reading.power]}, in a ring` : PRECISION[reading.power]);
  };

  // Rings and portraits. A caster sees the element of their own ring; the
  // other side sees only how thick it is.
  const RING_COLOURS = { fire: '#e08a4a', water: '#6fb0c8', earth: '#a39a86', air: '#9ec27a', metal: '#b4c0cc', hidden: 'url(#g-brass)', none: 'url(#g-brass)' };
  const ringName = (ring, own) => {
    if (!ring || !ring.strength) return 'no ring';
    const el = ring.elements[0];
    if (!el || el === 'hidden' || !own) return `a ring, ${ring.strength}`;
    return `ring of ${S.ELEMENT_NAMES[el]}${ring.elements[1] ? ` and ${S.ELEMENT_NAMES[ring.elements[1]]}` : ''}, ${ring.strength}`;
  };
  const ringArcs = (ring, own) => {
    if (!ring || !ring.strength) return '';
    const el = own && ring.elements[0] && ring.elements[0] !== 'hidden' ? ring.elements[0] : (ring.elements.length ? 'hidden' : 'none');
    const colour = RING_COLOURS[el] || S.ELEMENT_COLOURS[el];
    return Array.from({ length: ring.strength }, (_, i) => `<circle r="${62 + i * 5}" fill="none" stroke="${colour}" stroke-width="1.8" stroke-dasharray="${el === 'none' || el === 'hidden' ? '14 7' : '0'}" opacity="${(.95 - i * .2).toFixed(2)}"/>`).join('');
  };
  // Wounds are scars across the figure, one per strike that got through;
  // a scar beyond `shown` is drawn in.
  const woundMarks = (wounds, shown = 0) => Array.from({ length: Math.min(wounds || 0, S.HITS - 1) }, (_, i) => `<path class="wound${i >= shown && !reducedMotion.matches ? ' is-new' : ''}" d="${i % 2 ? 'M-20 -14L16 20' : 'M18 -16L-14 22'}" transform="translate(${i * 6} ${i * 4})"/>`).join('');
  const woundsName = wounds => !wounds ? '' : S.HITS === 2 ? 'wounded, ' : `${wounds} wound${wounds > 1 ? 's' : ''}, `;
  // What each portrait shows right now, so only a change is animated.
  const shown = { you: { wounds: 0, ring: '' }, foe: { wounds: 0, ring: '' } };
  const ringKey = ring => ring && ring.strength ? `${ring.elements.join('+')}:${ring.strength}` : '';
  const paintRing = (side, ring) => {
    const box = casters[side].querySelector('[data-barrier]'), key = ringKey(ring);
    if (key === shown[side].ring) return;
    shown[side].ring = key;
    box.innerHTML = ringArcs(ring, side === 'you');
    if (!reducedMotion.matches && ring && ring.strength) box.querySelectorAll('circle').forEach((circle, i) => {
      circle.style.transformBox = 'fill-box'; circle.style.transformOrigin = '50% 50%';
      circle.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'scale(1)' }], { duration: 520, delay: i * 90, easing: 'ease-out', fill: 'backwards' });
    });
  };
  const paintWounds = (side, wounds, death) => {
    const marks = casters[side].querySelector('[data-marks]');
    marks.innerHTML = death ? '' : woundMarks(wounds, shown[side].wounds);
    shown[side].wounds = death ? 0 : wounds || 0;
  };
  // Poses: the figure stands, casts, takes a blow, or lies where it fell.
  // A death keeps the pose its element calls for.
  const DEATH_POSES = { water: 'idle', air: 'idle', earth: 'idle' };
  const poseTimers = { you: 0, foe: 0 };
  const setPose = (side, pose, ms) => {
    const figure = casters[side];
    window.clearTimeout(poseTimers[side]);
    figure.dataset.pose = pose;
    if (ms) poseTimers[side] = window.setTimeout(() => { if (figure.dataset.pose === pose && !figure.classList.contains('is-dead')) figure.dataset.pose = 'idle'; }, ms);
  };
  // Which drawing stands on a side: a monster with symbols of its own id,
  // or the hooded figure.
  const setFigure = (side, kind) => {
    casters[side].querySelectorAll('[data-poses] use').forEach(use => {
      const suffix = use.dataset.pose === 'idle' ? '' : `-${use.dataset.pose}`;
      use.setAttribute('href', document.getElementById(`g-${kind}${suffix}`) ? `#g-${kind}${suffix}` : `#g-figure${suffix}`);
    });
  };
  const paintBody = (side, body, death) => {
    const figure = casters[side];
    paintRing(side, body.ring);
    paintWounds(side, body.wounds, death);
    figure.querySelector('[data-state]').textContent = death ? S.DEATHS[death].name : woundsName(body.wounds) + ringName(body.ring, side === 'you');
    figure.classList.toggle('is-dead', Boolean(death));
    figure.classList.toggle('is-wounded', !death && Boolean(body.wounds));
    if (death) { figure.dataset.death = death; setPose(side, DEATH_POSES[death] || 'fallen'); }
    else { delete figure.dataset.death; if (figure.dataset.pose === 'fallen') setPose(side, 'idle'); }
  };
  // The particles a cast trails and bursts with: its elements, brass for a
  // ring or a mirror, smoke for ink that was no glyph, nothing for nothing.
  const kindsOf = id => {
    if (id === 'blank') return [];
    if (id === 'fizzle') return ['ink'];
    const spell = S.byId[id];
    return spell && spell.elements.length ? spell.elements : ['brass'];
  };

  // The stage: each side's casting arrives as a token, and the reaction blooms between them.
  // A spell drawn in the defs has its own token; one added in the forge is
  // a disc of its element's colour until it gets art.
  const tokenFor = id => {
    const spell = S.byId[id];
    const symbol = `g-token-${spell.elements.length === 1 ? spell.elements[0] : id}`;
    if (document.getElementById(symbol)) return `<use href="#${symbol}"/>`;
    const [first, second] = spell.elements.map(e => S.ELEMENT_COLOURS[e]);
    return `<circle r="22" fill="#1b2420" stroke="url(#g-brass)" stroke-width="2"/><circle r="12" fill="${first || '#6b705f'}" stroke="${second || first || '#6b705f'}" stroke-width="4"/>`;
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
    stageArt.innerHTML = `<g class="stage-token" data-token="you" transform="translate(-92 0)">${rings(reaction.powers[0])}${tokenFor(yours)}</g><g class="stage-token" data-token="foe" transform="translate(92 0)">${rings(reaction.powers[1])}${tokenFor(theirs)}</g><g class="stage-burst" transform="translate(0 0)">${bursts}</g>`;
    stageName.textContent = reaction.name;
    if (!animate) return;
    stageName.textContent = '';
    // The spells draw back, fly, and meet: a flash, a jolt, a held breath,
    // then the reaction blooms.
    const tokens = { you: stageArt.querySelector('[data-token="you"]'), foe: stageArt.querySelector('[data-token="foe"]') };
    const fly = (token, from, to) => token.animate([
      { transform: `translate(${from}px, 0)`, opacity: 0 }, { transform: `translate(${from + Math.sign(from) * 16}px, 0)`, opacity: 1, offset: .25 }, { transform: `translate(${to}px, 0)`, opacity: 1 }
    ], { duration: TOKENS_MS, easing: 'cubic-bezier(.55, 0, .15, 1)' });
    fly(tokens.you, -150, -92); fly(tokens.foe, 150, 92);
    const spells = { you: yours, foe: theirs };
    for (const side of ['you', 'foe']) {
      setPose(side, 'cast', TOKENS_MS + HOLD_MS);
      for (const kind of kindsOf(spells[side])) M.emit({ follow: tokens[side], kind, rate: 45, duration: TOKENS_MS / 1000, speed: 50, lifeScale: .7, sizeScale: .8 });
    }
    M.play('cast');
    window.setTimeout(() => {
      const [cx, cy] = M.at(stageArt, .5, .5);
      M.flash(arenaFlash); M.shake(arena, 7, 340); M.play('clash');
      for (const side of ['you', 'foe']) for (const kind of kindsOf(spells[side])) M.burst(cx, cy, kind, 32, { speed: 300, lifeScale: 1.1 });
      window.setTimeout(() => { stage.classList.add('is-animating'); stageName.textContent = reaction.name; }, HOLD_MS);
    }, TOKENS_MS);
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
    const hand = entry => typeof entry.distance === 'number' ? { 1: 'drawn', 2: 'drawn clean', 3: 'drawn perfect' }[S.powerFor(entry.distance)] : 'drawn';
    el('grimoire-list').innerHTML = entries.map(spell => `<li data-hand="${typeof grimoire[spell.id].distance === 'number' ? S.powerFor(grimoire[spell.id].distance) : 1}">${thumbnail(grimoire[spell.id].strokes)}<div><strong>${spell.name}</strong><small>${spell.element ? spell.element : spell.kind} · ${hand(grimoire[spell.id])}</small></div></li>`).join('');
  };
  // A glyph is written the first time it works, and rewritten whenever a
  // closer drawing of it is cast.
  const recordGlyph = (id, strokes, distance) => {
    const grimoire = loadGrimoire();
    const known = grimoire[id];
    if (known && !(typeof distance === 'number' && (typeof known.distance !== 'number' || distance < known.distance))) return;
    // Fit the drawing into a unit box so the thumbnail is the player's hand, not the sheet.
    const pts = strokes.flat();
    const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
    const size = Math.max(Math.max(...pts.map(p => p[0])) - minX, Math.max(...pts.map(p => p[1])) - minY) || 1;
    const offX = (1 - (Math.max(...pts.map(p => p[0])) - minX) / size) / 2, offY = (1 - (Math.max(...pts.map(p => p[1])) - minY) / size) / 2;
    const fitted = strokes.map(s => s.filter((_, i) => i % 3 === 0 || i === s.length - 1).map(p => [+(offX + (p[0] - minX) / size * .84 + .08).toFixed(3), +(offY + (p[1] - minY) / size * .84 + .08).toFixed(3)]));
    grimoire[id] = { strokes: fitted, distance: typeof distance === 'number' ? +distance.toFixed(3) : undefined, when: new Date().toISOString() };
    saveGrimoire(grimoire);
    renderGrimoire();
  };

  // What happened to each caster this round: badges by the portrait, a flash
  // on the figure, and a plain outcome line. The other caster's ring is never
  // named by element, except by what a strike reveals of it.
  const outcomeFor = (side, result, index, spellId) => {
    const own = side === 'you';
    const items = [];
    const raised = result.raised[index];
    if (raised) {
      const r = raised.after;
      const name = own ? ringName(r, true) : `a ring, ${r.strength}`;
      items.push({ kind: 'barrier', fx: 'raise', text: r.strength > raised.before.strength || raised.before.elements.join() !== r.elements.join() ? `${name} raised` : `${name} stands` });
    }
    // Each blow says what it did to the ring, in the wheel's words: turned
    // aside (ring untouched), straight through (the wheel), broken (power as
    // high as the ring), or worn (power off the ring). The badge is short;
    // the outcome line carries the numbers and the reason.
    for (const blow of result.blows[index]) {
      if (blow.spent) continue;
      const by = S.ELEMENT_NAMES[blow.element], why = blow.why ? ` (${blow.why})` : '';
      if (blow.how === 'aside') items.push({ kind: 'barrier', fx: 'aside', element: blow.element, text: 'turned aside', line: `the ring turns ${by} aside${why}` });
      else if (blow.how === 'pierced') items.push({ kind: blow.element, fx: 'strike', element: blow.element, text: `${by} straight through`, line: `${by} goes straight through the ring${why}` });
      else if (blow.how === 'broken') items.push({ kind: blow.element, fx: 'broken', element: blow.element, text: `${by} breaks the ring`, line: `${by} at ${blow.power} breaks the ring of ${blow.worn}` });
      else if (blow.how === 'worn') items.push({ kind: 'barrier', fx: 'worn', element: blow.element, text: `ring takes ${by} ${blow.power}`, line: `the ring takes ${by} at ${blow.power}, ${blow.left} left` });
      else items.push({ kind: blow.element, fx: 'strike', element: blow.element, text: `${by} strikes, no ring` });
      // A strike that gets through is a wound, whatever its power; the last
      // wound is the death badge instead.
      if (blow.through && blow.wound && blow.wound < S.HITS) items.push({ kind: 'wound', fx: 'wound', wounds: blow.wound, text: S.HITS === 2 ? 'wounded' : `wound ${blow.wound} of ${S.HITS}`, line: S.HITS === 2 ? 'is wounded: one more strike and they fall' : `takes wound ${blow.wound} of ${S.HITS}` });
    }
    if (result.deaths[index]) items.push({ kind: 'death', fx: 'death', element: result.deaths[index], text: S.DEATHS[result.deaths[index]].name });
    if (!items.length) items.push({ kind: 'none', fx: 'none', text: spellId === 'blank' ? 'nothing' : 'untouched' });
    return items;
  };
  const isBlow = item => S.ELEMENTS.includes(item.kind) || item.kind === 'death' || item.kind === 'wound';
  // Each badge lands with its own motion on the portrait: sparks off a ring
  // that holds, the element bursting on a strike, a scar drawn in, the
  // figure jolting or falling. The ring is repainted when its badge lands.
  const playItem = (side, item, body, death) => {
    const figure = casters[side], portrait = figure.querySelector('.portrait'), barrier = figure.querySelector('[data-barrier]');
    const [x, y] = M.at(portrait, .5, .45), r = M.radiusOf(portrait) * .95, inward = side === 'you' ? 0 : Math.PI;
    const jolt = () => { figure.classList.remove('is-hit', 'is-healed'); void figure.offsetWidth; figure.classList.add('is-hit'); };
    switch (item.fx) {
      case 'raise':
        paintRing(side, body.ring);
        M.burst(x, y, 'brass', 28, { radius: r, speed: 50, lifeScale: 1.2 });
        figure.classList.add('is-healed');
        M.play('ring');
        break;
      case 'aside':
        barrier.style.transformBox = 'fill-box'; barrier.style.transformOrigin = '50% 50%';
        M.pulse(barrier, 1.1, 420);
        M.burst(x + Math.cos(inward) * r, y, 'brass', 22, { speed: 190, angle: inward, arc: 1 });
        M.burst(x + Math.cos(inward) * r, y, item.element, 12, { speed: 150, angle: inward, arc: .8 });
        M.play('aside');
        break;
      case 'worn':
        M.burst(x + Math.cos(inward) * r, y, item.element, 20, { speed: 160, angle: inward, arc: 1.2 });
        paintRing(side, body.ring);
        M.play('worn');
        break;
      case 'broken':
        barrier.style.transformBox = 'fill-box'; barrier.style.transformOrigin = '50% 50%';
        if (!reducedMotion.matches && barrier.animate) barrier.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' }).onfinish = () => { barrier.getAnimations().forEach(a => a.cancel()); paintRing(side, body.ring); };
        else paintRing(side, body.ring);
        M.burst(x, y, 'brass', 36, { radius: r, speed: 240 });
        M.burst(x, y, item.element, 24, { speed: 200 });
        jolt();
        M.play('broken');
        break;
      case 'strike':
        M.burst(x, y, item.element, 40, { speed: 240, radius: r * .3 });
        setPose(side, 'struck', 650);
        jolt();
        M.play('strike', item.element);
        break;
      case 'wound':
        M.burst(x, y, 'rose', 22, { speed: 170, radius: r * .2 });
        paintWounds(side, item.wounds, false);
        figure.classList.add('is-wounded');
        M.play('wound');
        break;
      case 'death': {
        paintBody(side, body, death);
        M.burst(x, y, item.element, 70, { speed: 260, radius: r * .4, lifeScale: 1.4 });
        if (item.element === 'fire') M.emit({ follow: portrait, fy: .7, kind: 'fire', rate: 30, duration: 2.8, speed: 60, lifeScale: 1.3 });
        if (item.element === 'fire') M.emit({ follow: portrait, fy: .5, kind: 'ash', rate: 12, duration: 2.8, speed: 30 });
        if (item.element === 'air') M.emit({ follow: portrait, kind: 'air', rate: 40, duration: 1.6, speed: 160, angle: -Math.PI / 3, arc: .6, lifeScale: 1.4 });
        if (item.element === 'water') M.emit({ follow: portrait, fy: .9, kind: 'water', rate: 40, duration: 1.4, speed: 120, angle: -Math.PI / 2, arc: .5 });
        if (item.element === 'earth') M.emit({ follow: portrait, fy: .8, kind: 'earth', rate: 30, duration: 1.2, speed: 60 });
        jolt();
        M.play('death', item.element);
        break;
      }
      default:
        break;
    }
  };
  const showHits = (side, items, body, death) => {
    const figure = casters[side], list = figure.querySelector('[data-hits]');
    list.innerHTML = items.map((item, i) => `<li data-kind="${item.kind}" style="${S.ELEMENT_COLOURS[item.kind] ? `--el:${S.ELEMENT_COLOURS[item.kind]};` : ''}animation-delay:${reducedMotion.matches ? 0 : i * HIT_MS}ms">${item.text}</li>`).join('');
    figure.classList.remove('is-hit', 'is-healed');
    void figure.offsetWidth;
    if (reducedMotion.matches) {
      if (items.some(isBlow)) figure.classList.add('is-hit');
      else if (items.some(item => item.kind === 'barrier')) figure.classList.add('is-healed');
      paintBody(side, body, death);
      return;
    }
    items.forEach((item, i) => window.setTimeout(() => playItem(side, item, body, death), i * HIT_MS));
    // Whatever the badges did, the portrait ends the round as the rules left it.
    window.setTimeout(() => paintBody(side, body, death), items.length * HIT_MS + 400);
  };
  const clearHits = () => Object.values(casters).forEach(figure => { figure.querySelector('[data-hits]').innerHTML = ''; figure.classList.remove('is-hit', 'is-healed'); });
  // Narration, for the eye and the screen reader.
  const narrate = html => { narration.innerHTML = html; };
  const outcomeLine = (name, items) => `<span data-kind="${items.some(i => S.ELEMENTS.includes(i.kind) || i.kind === 'death' || i.kind === 'wound') ? 'hit' : items.some(i => i.kind === 'barrier') ? 'heal' : 'none'}"><strong>${name}</strong> ${items.map(i => i.line || i.text).join(', ')}</span>`;
  const HANDS = { 1: '', 2: ', cleanly', 3: ', perfectly' };
  // A compound is cast below the hand that drew it, and the line says so.
  const costNote = (id, power, cast) => cast < power ? `, cast at ${cast} as a compound` : '';
  const yourCastLine = (id, power, cast = power) => {
    const spell = S.byId[id];
    if (id === 'blank') return 'You cast nothing.';
    if (id === 'fizzle') return 'Your ink smoulders; it was no glyph.';
    return `You cast <em>${spell.name}</em>${HANDS[power] || ''}${costNote(id, power, cast)}.`;
  };
  const foeCastLine = (id, power, cast = power) => {
    if (id === 'blank') return `${el('foe-name').textContent} cast nothing.`;
    if (id === 'fizzle') return `${el('foe-name').textContent}'s ink smouldered.`;
    const spell = S.byId[S.maskCast(id)];
    const name = spell.kind === 'barrier' ? 'a ring' : spell.kind === 'defence' ? 'a mirror' : spell.name.toLowerCase();
    return `${el('foe-name').textContent} cast ${name}${HANDS[power] || ''}${costNote(id, power, cast)}.`;
  };


  // The clock and the round.
  const setTimer = remaining => {
    const fraction = Math.max(0, remaining / S.ROUND_SECONDS);
    timerRing.style.strokeDashoffset = (ringLength * (1 - fraction)).toFixed(2);
    const seconds = String(Math.ceil(Math.max(0, remaining)));
    const late = remaining <= 3 && state.phase === 'drawing';
    // The last seconds are counted out loud.
    if (late && timerSeconds.textContent !== seconds && remaining > 0) { M.play('tick'); M.pop(timerSeconds, 1.35, 260); }
    timerSeconds.textContent = seconds;
    timerBox.classList.toggle('is-late', late);
    frame.classList.toggle('is-late', late);
  };
  const setQuill = mode => { if (mode) quill.dataset.quill = mode; else delete quill.dataset.quill; };
  const clearSheet = () => { state.strokes = []; paintSheet(); resonate(); };
  // A round opens the same way whoever the opponent is; only who resolves it differs.
  const openRound = (round, seconds = S.ROUND_SECONDS) => {
    state.round = round;
    state.phase = 'drawing';
    state.locked = null;
    clearHits();
    nextBox.hidden = true;
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
    state.foeSpell = S.chooseSpell(monster, state.foe, S.maskBody(state.you), state.history, Math.random, state.known);
    state.foePower = S.monsterPower(monster);
    openRound(state.round + 1);
  };
  const sealSheet = () => {
    drawing = false;
    const reading = readSheet();
    state.locked = reading.id;
    state.power = reading.power;
    state.distance = reading.candidates[0] ? reading.candidates[0].distance : null;
    state.strokesCast = state.strokes.filter(s => s.length > 1);
    frame.classList.add('is-locked');
    castButton.disabled = true; clearButton.disabled = true;
    if (state.locked !== 'blank') { sealInk(); M.play(state.locked === 'fizzle' ? 'ink' : 'seal'); }
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
    M.unlock();
    sealSheet();
    if (net.mode === 'online') {
      showSheetState(state.locked === 'blank' ? 'nothing · waiting for the other caster' : 'cast · waiting for the other caster');
      sendCast();
      return;
    }
    showSheetState(state.locked === 'blank' ? 'nothing' : 'cast');
    // Casting seals both sheets: the monster answers at once.
    resolveRound();
  };
  const sendCast = () => {
    state.phase = 'locked';
    cancelAnimationFrame(state.timer);
    if (net.socket) net.socket.emit('glyphs:cast', { id: state.locked, power: state.power });
  };
  // Against the monster the page runs the rules itself.
  const resolveRound = () => {
    state.phase = 'resolving';
    cancelAnimationFrame(state.timer);
    if (!state.locked) sealSheet();
    const yours = state.locked, theirs = state.foeSpell;
    const powers = [state.power, state.foePower];
    const result = S.applyRound(state.you, state.foe, yours, theirs, powers);
    // A strike on the player's ring tells the monster what the ring is made
    // of; a new ring of another element is a secret again.
    if (result.blows[0].some(b => !b.spent)) state.known = result.bodies[0].ring.elements.slice();
    if (result.raised[0] && result.raised[0].before.elements.join() !== result.raised[0].after.elements.join()) state.known = null;
    if (!result.bodies[0].ring.strength) state.known = null;
    presentRound(yours, theirs, powers, result, waitForNext);
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
    if (yours !== 'blank' && yours !== 'fizzle') recordGlyph(S.isRing(yours) ? S.byId[yours].of : yours, S.isRing(yours) ? R.splitRing(state.strokesCast).inner : state.strokesCast, state.distance);
    const animate = !reducedMotion.matches;
    const foeName = el('foe-name').textContent;
    const yourItems = outcomeFor('you', result, 0, yours), foeItems = outcomeFor('foe', result, 1, theirs);
    const story = `<p>Round ${state.round}. ${yourCastLine(yours, powers[0], result.reaction.powers[0])} ${foeCastLine(theirs, powers[1], result.reaction.powers[1])}</p><p class="narration-reaction"><strong>${result.reaction.name}</strong>${result.reaction.line}</p><p class="narration-outcomes">${outcomeLine('You', yourItems)}${outcomeLine(foeName, foeItems)}</p>`;
    const [youDead, foeDead] = result.deaths;
    showScene('arena');
    nextBox.hidden = true;
    // The sheet goes, the spells cross, the reaction blooms, then the rings
    // answer one badge at a time, and the words follow.
    const t1 = sceneDelay(), t2 = t1 + (animate ? TOKENS_MS + BLOOM_MS : 0);
    window.setTimeout(() => paintStage(yours, S.maskCast(theirs), result.reaction, animate), t1);
    window.setTimeout(() => {
      showHits('you', yourItems, state.you, youDead);
      showHits('foe', foeItems, state.foe, foeDead);
      narrate(story + (youDead && foeDead ? '<p>Both fall in the same breath.</p>' : ''));
      const settle = animate ? HIT_MS * Math.max(yourItems.length, foeItems.length) + 600 : 0;
      if (youDead || foeDead) {
        window.setTimeout(() => endDuel(youDead, foeDead), settle);
        return;
      }
      window.setTimeout(next, settle);
    }, t2);
  };
  // Against the monster the next sheet waits for the player; between phones
  // the server sets the pace and the page counts it down.
  let countdown = 0;
  const waitForNext = () => {
    state.phase = 'between';
    nextNote.textContent = '';
    nextButton.hidden = false;
    nextBox.hidden = false;
    nextButton.focus({ preventScroll: true });
  };
  const countDownTo = ms => {
    state.phase = 'between';
    nextButton.hidden = true;
    nextBox.hidden = false;
    const until = performance.now() + ms;
    cancelAnimationFrame(countdown);
    const tick = () => {
      const left = Math.ceil((until - performance.now()) / 1000);
      if (left <= 0 || state.phase !== 'between') { nextNote.textContent = ''; return; }
      nextNote.textContent = `The next sheet comes in ${left} s.`;
      countdown = requestAnimationFrame(tick);
    };
    tick();
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
    M.play(youDead ? 'lose' : 'win');
  };
  // The table is set, but nothing moves until the player is ready.
  const startDuel = () => {
    cancelAnimationFrame(state.timer);
    state.round = 0; state.history = []; state.phase = 'ready'; state.known = null;
    state.you = S.emptyBody(); state.foe = S.emptyBody();
    M.clear();
    setFigure('you', 'figure'); setFigure('foe', net.mode === 'online' ? 'figure' : monster.id);
    setPose('you', 'idle'); setPose('foe', 'idle');
    paintBody('you', state.you, null); paintBody('foe', state.foe, null);
    clearStage();
    clearHits();
    duelEnd.hidden = true;
    nextBox.hidden = true;
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
    M.unlock();
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
    socket.on('glyphs:round', ({ round, seconds }) => { duelEnd.hidden = true; nextBox.hidden = true; openRound(round, seconds); });
    socket.on('glyphs:sealed', () => { if (state.phase === 'drawing' || state.phase === 'locked') setQuill('sealed'); });
    socket.on('glyphs:result', ({ round, yours, theirs, powers, result, nextIn }) => {
      state.round = round;
      if (!state.locked) sealSheet();
      const arrived = performance.now();
      presentRound(yours, theirs, powers, result, () => countDownTo(Math.max(0, (nextIn || 0) - (performance.now() - arrived))));
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
  nextButton.addEventListener('click', () => { if (state.phase === 'between' && net.mode !== 'online') startRound(); });
  // Sound can be put out; the choice is kept.
  const paintSound = () => { soundButton.textContent = M.soundOn() ? 'Sound on' : 'Sound off'; soundButton.setAttribute('aria-pressed', String(M.soundOn())); };
  soundButton.addEventListener('click', () => { M.setSound(!M.soundOn()); paintSound(); if (M.soundOn()) M.play('ink'); });
  paintSound();
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
