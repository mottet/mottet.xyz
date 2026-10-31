'use strict';

// Glyphs: the spells, how they react, and how a caster's body comes apart.
// Pure rules over the data in glyphs-data.js. The same file serves the game
// page, the designer grimoire, the forge and the Node checks, so it carries
// no DOM. `build(data)` makes a fresh set of rules from any data, which is
// how the forge tries an edit before it is saved.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./glyphs-data.js'));
  else root.GlyphsSpells = factory(root.GlyphsData);
})(typeof self !== 'undefined' ? self : this, function (DATA) {
  // Glyph geometry in a unit box, drawn as the templates for recognition and
  // as the figures in the grimoire. A shape spec names a generator and its
  // parameters and yields a list of strokes.
  const arc = (cx, cy, r, from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + (to - from) * i / steps;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
  const segment = (a, b, steps) => Array.from({ length: steps + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps]);
  const polyline = points => points.slice(1).reduce((out, p, i) => out.concat(segment(points[i], p, 12).slice(1)), [points[0]]);
  const upright = () => segment([.5, .05], [.5, .95], 24);
  const SHAPES = {
    triangle: { params: {}, strokes: () => [polyline([[.5, .05], [.95, .9], [.05, .9], [.5, .05]])] },
    square: { params: {}, strokes: () => [polyline([[.08, .08], [.92, .08], [.92, .92], [.08, .92], [.08, .08]])] },
    circle: { params: {}, strokes: () => [arc(.5, .5, .45, -Math.PI / 2, Math.PI * 1.5, 48)] },
    wave: { params: { crests: 2 }, strokes: ({ crests }) => [Array.from({ length: 49 }, (_, i) => { const t = i / 48; return [t, .5 - .22 * Math.sin(t * Math.PI * 2 * crests)]; })] },
    spiral: { params: { turns: 2, sign: 1 }, strokes: ({ turns, sign }) => [Array.from({ length: 73 }, (_, i) => { const t = i / 72, a = sign * t * Math.PI * 2 * turns, r = .05 + .42 * t; return [.5 + r * Math.cos(a), .5 + r * Math.sin(a)]; })] },
    upright: { params: {}, strokes: () => [upright()] },
    // Two strokes, one laid across the other.
    cross: { params: {}, strokes: () => [upright(), segment([.05, .5], [.95, .5], 24)] },
    bolt: { params: {}, strokes: () => [polyline([[.66, .04], [.34, .52], [.62, .48], [.34, .96]])] },
    // Three strokes crossing at the centre; `tilt` is the angle of the arms in degrees.
    crystal: { params: { tilt: 60 }, strokes: ({ tilt }) => { const t = tilt * Math.PI / 180; return [upright(), segment([.5 - .45 * Math.sin(t), .5 - .45 * Math.cos(t)], [.5 + .45 * Math.sin(t), .5 + .45 * Math.cos(t)], 24), segment([.5 + .45 * Math.sin(t), .5 - .45 * Math.cos(t)], [.5 - .45 * Math.sin(t), .5 + .45 * Math.cos(t)], 24)]; } },
    tendril: { params: { sign: 1 }, strokes: ({ sign }) => [Array.from({ length: 49 }, (_, i) => { const t = i / 48; return [.5 + sign * .3 * Math.sin(t * Math.PI * 2), .05 + .9 * t]; })] },
    cup: { params: {}, strokes: () => [polyline([[.05, .1], [.95, .1], [.5, .95], [.05, .1]])] },
    // Corners joined by straight legs, as [[x, y], ...] in the unit box.
    polyline: { params: { points: [[.1, .9], [.9, .1]] }, strokes: ({ points }) => [polyline(points)] },
    // Strokes recorded as drawn, [[[x, y], ...], ...] in the unit box.
    strokes: { params: { strokes: [[[.1, .5], [.9, .5]]] }, strokes: ({ strokes }) => strokes.map(s => s.map(p => p.slice())) }
  };
  const SHAPE_KINDS = Object.keys(SHAPES);
  const strokesOf = spec => SHAPES[spec.kind].strokes({ ...SHAPES[spec.kind].params, ...spec });

  const ID = /^[a-z][a-z0-9-]*$/;
  const RESERVED = ['blank', 'fizzle', 'hidden', 'none'];
  const RING_PREFIX = 'ring-';
  const KINDS = ['attack', 'barrier', 'defence'];
  const RELATION_KINDS = ['beats', 'quench', 'pass'];
  const isPoint = p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && v >= -0.5 && v <= 1.5);
  // Every way the data can be wrong, as plain sentences. Empty means it builds.
  function validate(data) {
    const problems = [];
    const say = s => problems.push(s);
    if (!data || typeof data !== 'object') return ['The data is not an object.'];
    const round = data.round || {};
    for (const key of ['seconds', 'maxPower', 'maxRing']) if (!(Number.isFinite(round[key]) && round[key] > 0)) say(`round.${key} must be a positive number.`);
    if (!Array.isArray(round.powerLevels) || !round.powerLevels.every(l => l && Number.isFinite(l.within) && Number.isInteger(l.power))) say('round.powerLevels must be a list of { within, power }.');
    if (round.compoundCost !== undefined && !(Number.isInteger(round.compoundCost) && round.compoundCost >= 0)) say('round.compoundCost must be a whole number, 0 or more: the power a two-element spell gives up.');
    if (round.hits !== undefined && !(Number.isInteger(round.hits) && round.hits >= 1)) say('round.hits must be a whole number, 1 or more: the strikes that must get through to kill.');
    const elements = Array.isArray(data.elements) ? data.elements : [];
    if (!elements.length) say('There must be at least one element.');
    const elementIds = new Set();
    elements.forEach((e, i) => {
      const who = `Element ${i + 1}${e && e.id ? ` (${e.id})` : ''}`;
      if (!e || typeof e !== 'object') return say(`${who} is not an object.`);
      if (!ID.test(e.id || '')) say(`${who}: the id must be lowercase letters, digits and dashes, starting with a letter.`);
      else if (RESERVED.includes(e.id)) say(`${who}: "${e.id}" is a reserved word.`);
      else if (elementIds.has(e.id)) say(`${who}: the id is used twice.`);
      elementIds.add(e.id);
      if (!(typeof e.name === 'string' && e.name.trim())) say(`${who}: it needs a name.`);
      if (!/^#[0-9a-fA-F]{6}$/.test(e.color || '')) say(`${who}: the colour must be a hex colour like #d8632a.`);
      if (!e.death || typeof e.death.name !== 'string' || !e.death.name.trim() || typeof e.death.line !== 'string') say(`${who}: it needs a death with a name and a line.`);
    });
    const relations = Array.isArray(data.relations) ? data.relations : [];
    const pairs = new Set();
    relations.forEach((r, i) => {
      const who = `Relation ${i + 1}`;
      if (!r || typeof r !== 'object') return say(`${who} is not an object.`);
      if (!RELATION_KINDS.includes(r.kind)) say(`${who}: the kind must be one of ${RELATION_KINDS.join(', ')}.`);
      for (const end of ['from', 'to']) if (!elementIds.has(r[end])) say(`${who}: "${r[end]}" is not an element.`);
      if (r.from === r.to) say(`${who}: an element cannot stand against itself.`);
      const key = [r.from, r.to].sort().join(' ');
      if (pairs.has(key)) say(`${who}: ${r.from} and ${r.to} already have a relation; a pair has one at most.`);
      pairs.add(key);
    });
    const spells = Array.isArray(data.spells) ? data.spells : [];
    const spellIds = new Set();
    let bare = 0;
    spells.forEach((s, i) => {
      const who = `Spell ${i + 1}${s && s.id ? ` (${s.id})` : ''}`;
      if (!s || typeof s !== 'object') return say(`${who} is not an object.`);
      if (!ID.test(s.id || '')) say(`${who}: the id must be lowercase letters, digits and dashes, starting with a letter.`);
      else if (RESERVED.includes(s.id) || s.id.startsWith(RING_PREFIX)) say(`${who}: "${s.id}" is reserved.`);
      else if (spellIds.has(s.id)) say(`${who}: the id is used twice.`);
      spellIds.add(s.id);
      if (!(typeof s.name === 'string' && s.name.trim())) say(`${who}: it needs a name.`);
      if (!KINDS.includes(s.kind)) say(`${who}: the kind must be one of ${KINDS.join(', ')}.`);
      const els = Array.isArray(s.elements) ? s.elements : [];
      els.forEach(e => { if (!elementIds.has(e)) say(`${who}: "${e}" is not an element.`); });
      if (new Set(els).size !== els.length) say(`${who}: an element is listed twice.`);
      if (s.kind === 'attack' && (els.length < 1 || els.length > 2)) say(`${who}: an attack has one element, or two for a compound.`);
      if (s.kind === 'barrier' && els.length) say(`${who}: a barrier has no element; rings of an element come from drawing an attack inside a circle.`);
      if (s.kind === 'barrier') bare++;
      if (s.kind === 'defence') { if (els.length) say(`${who}: a defence has no element.`); (s.reflects || []).forEach(e => { if (!elementIds.has(e)) say(`${who}: reflects "${e}", which is not an element.`); }); }
      const shapes = Array.isArray(s.shapes) ? s.shapes : [];
      if (!shapes.length) say(`${who}: it needs at least one shape; the first is the glyph, the rest are variants.`);
      shapes.forEach((sh, j) => {
        if (!sh || !SHAPES[sh.kind]) return say(`${who}, shape ${j + 1}: the kind must be one of ${SHAPE_KINDS.join(', ')}.`);
        for (const [p, dflt] of Object.entries(SHAPES[sh.kind].params)) {
          const v = sh[p] === undefined ? dflt : sh[p];
          if (typeof dflt === 'number' && !Number.isFinite(v)) say(`${who}, shape ${j + 1}: ${p} must be a number.`);
          if (p === 'points' && !(Array.isArray(v) && v.length >= 2 && v.every(isPoint))) say(`${who}, shape ${j + 1}: points must be at least two [x, y] pairs between 0 and 1.`);
          if (p === 'strokes' && !(Array.isArray(v) && v.length >= 1 && v.every(st => Array.isArray(st) && st.length >= 2 && st.every(isPoint)))) say(`${who}, shape ${j + 1}: strokes must be lists of at least two [x, y] pairs between 0 and 1.`);
        }
        if (sh.kind === 'spiral' && sh.sign !== undefined && sh.sign !== 1 && sh.sign !== -1) say(`${who}, shape ${j + 1}: sign is 1 or -1.`);
        if (sh.kind === 'tendril' && sh.sign !== undefined && sh.sign !== 1 && sh.sign !== -1) say(`${who}, shape ${j + 1}: sign is 1 or -1.`);
      });
    });
    if (bare !== 1) say(`There must be exactly one barrier spell (the bare ring the other caster is shown); there are ${bare}.`);
    const simple = new Set(spells.filter(s => s && ((s.kind === 'attack' && Array.isArray(s.elements) && s.elements.length === 1) || s.kind === 'defence')).map(s => s.id));
    const reactions = data.reactions && typeof data.reactions === 'object' ? data.reactions : {};
    const seen = new Set();
    for (const [key, r] of Object.entries(reactions)) {
      const ids = key.split(' ');
      if (ids.length !== 2 || !ids.every(id => simple.has(id))) { say(`Reaction "${key}": the key is two ids of single-element attacks or defences, separated by a space.`); continue; }
      const norm = ids.slice().sort().join(' ');
      if (seen.has(norm)) say(`Reaction "${key}": the pair is written twice.`);
      seen.add(norm);
      if (!r || typeof r !== 'object') { say(`Reaction "${key}" is not an object.`); continue; }
      if (!(typeof r.name === 'string' && r.name.trim())) say(`Reaction "${key}": it needs a name.`);
      if (typeof r.line !== 'string') say(`Reaction "${key}": it needs a line.`);
      for (const side of ['x', 'y']) {
        const marks = r[side] || {};
        if (typeof marks !== 'object') { say(`Reaction "${key}": ${side} must be an object of element: count.`); continue; }
        for (const [e, n] of Object.entries(marks)) {
          if (!elementIds.has(e)) say(`Reaction "${key}": "${e}" is not an element.`);
          if (!(Number.isInteger(n) && n >= 0)) say(`Reaction "${key}": ${e} must be a whole number of strikes.`);
        }
      }
    }
    return problems;
  }

  function build(data) {
    const problems = validate(data);
    if (problems.length) { const error = new Error('Glyphs data is not valid:\n' + problems.join('\n')); error.problems = problems; throw error; }
    const ELEMENTS = data.elements.map(e => e.id);
    const elementsById = Object.fromEntries(data.elements.map(e => [e.id, e]));
    const ELEMENT_NAMES = Object.fromEntries(data.elements.map(e => [e.id, e.name]));
    const ELEMENT_COLOURS = Object.fromEntries(data.elements.map(e => [e.id, e.color]));
    const DEATHS = Object.fromEntries(data.elements.map(e => [e.id, e.death]));
    const ROUND_SECONDS = data.round.seconds;
    // A spell is as strong as the hand that drew it: the recogniser's distance
    // to the glyph sets its power, one to three.
    const MAX_POWER = data.round.maxPower;
    const POWER_LEVELS = data.round.powerLevels.slice().sort((p, q) => p.within - q.within);
    const powerFor = distance => { const level = POWER_LEVELS.find(l => distance <= l.within); return level ? level.power : 1; };
    // There are no life points and no marks. A caster stands behind one ring at
    // most, of a strength up to this; a strike that gets through the ring
    // wounds, whatever its power, and HITS wounds kill.
    const MAX_RING = data.round.maxRing;
    const HITS = Number.isInteger(data.round.hits) ? data.round.hits : 1;
    // A compound is also cast weaker than the hand drew it, never below 1.
    const COMPOUND_COST = Number.isInteger(data.round.compoundCost) ? data.round.compoundCost : 1;

    // How two elements stand to one another: one beats the other, they quench
    // each other (both rings strong, attacks cancel), they pass each other
    // (both rings weak, attacks both land), or nothing.
    const relations = data.relations.map(r => ({ ...r }));
    const beats = Object.fromEntries(ELEMENTS.map(e => [e, relations.filter(r => r.kind === 'beats' && r.from === e).map(r => r.to)]));
    function findRelationKind(a, b) {
      if (a === b) return 'same';
      const r = relations.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a));
      if (!r) return 'none';
      if (r.kind === 'beats') return r.from === a ? 'beats' : 'beaten';
      return r.kind;
    }
    // Looked up on every strike the monster imagines, so tabled once.
    const RELATION_TABLE = {};
    for (const a of ELEMENTS) for (const b of ELEMENTS) RELATION_TABLE[`${a} ${b}`] = findRelationKind(a, b);
    const relationKind = (a, b) => RELATION_TABLE[`${a} ${b}`] || findRelationKind(a, b);
    function setRelation(a, b, kind) {
      // For the forge: returns a new relations list with the pair set to
      // `kind` ('beats' from a to b, 'beaten', 'quench', 'pass' or 'none').
      const rest = relations.filter(r => !((r.from === a && r.to === b) || (r.from === b && r.to === a))).map(r => ({ ...r }));
      if (kind === 'beats') rest.push({ kind: 'beats', from: a, to: b });
      else if (kind === 'beaten') rest.push({ kind: 'beats', from: b, to: a });
      else if (kind === 'quench' || kind === 'pass') rest.push({ kind, from: a, to: b });
      return rest;
    }

    const spells = data.spells.map(s => {
      const variants = s.shapes.map(strokesOf);
      return { ...s, elements: s.elements.slice(), element: s.elements.length === 1 ? s.elements[0] : null, reflects: (s.reflects || []).slice(), strokes: variants[0], variants };
    });
    const SINGLE = Object.fromEntries(spells.filter(s => s.kind === 'attack' && s.elements.length === 1).map(s => [s.elements[0], s.id]));
    const WARD = spells.find(s => s.kind === 'barrier');
    // An attack drawn inside a circle is a ring of that element: the glyph is
    // not written down either, only the way of enclosing it.
    const ringId = spellId => RING_PREFIX + spellId;
    const isRing = id => typeof id === 'string' && id.startsWith(RING_PREFIX);
    const circle = strokesOf({ kind: 'circle' });
    const rings = spells.filter(s => s.kind === 'attack').map(s => ({ id: ringId(s.id), name: `Ring of ${s.name}`, of: s.id, element: s.element, elements: s.elements, kind: 'barrier', glyph: `${s.glyph}, inside a circle`, flavour: `The ${s.name.toLowerCase()} held in a ring. It stands on the floor until it is worn through, and the other caster sees only a ring.`, strokes: circle.concat(s.strokes) }));
    const BLANK = { id: 'blank', name: 'Blank', element: null, elements: [], kind: 'blank', glyph: 'a blank sheet', flavour: 'Draw nothing. Nothing is cast.' };
    const FIZZLE = { id: 'fizzle', name: 'Fizzle', element: null, elements: [], kind: 'fizzle', glyph: 'a drawing that is no glyph', flavour: 'The ink smoulders and nothing comes of it.' };
    const OPTIONS = spells.map(s => s.id).concat(rings.filter(r => spells.find(s => s.id === r.of).elements.length === 1).map(r => r.id), 'blank');
    const byId = Object.fromEntries(spells.concat(rings, BLANK, FIZZLE).map(s => [s.id, s]));
    // The spells that react in their own right: single-element attacks and
    // defences. Compounds are made of these, rings and blanks strike no one.
    const SIMPLE = spells.filter(s => (s.kind === 'attack' && s.elements.length === 1) || s.kind === 'defence').map(s => s.id);

    // Reactions between two cast spells. `x` are the strikes taken by the
    // caster of the first id, `y` by the second. A pair written in the data
    // is used as written; any other pair follows from the relations.
    const R = (name, x, y, line, derived = false) => ({ name, x, y, line, derived });
    const written = {};
    for (const [key, r] of Object.entries(data.reactions || {})) written[key] = R(r.name, { ...(r.x || {}) }, { ...(r.y || {}) }, r.line);
    function derivedReaction(aId, bId) {
      const a = byId[aId], b = byId[bId];
      const A = a.name, B = b.name.toLowerCase();
      if (a.kind === 'defence' && b.kind === 'defence') return R('stillness', {}, {}, 'Two guards and no blow. Nothing moves.', true);
      if (a.kind === 'defence' || b.kind === 'defence') {
        const guardFirst = a.kind === 'defence', guard = guardFirst ? a : b, attack = guardFirst ? b : a;
        const e = attack.elements[0], marks = { [e]: 1 };
        const reflected = guard.reflects.includes(e);
        const attackerTakes = reflected ? marks : {}, guardTakes = reflected ? {} : marks;
        const line = reflected ? `The ${guard.name.toLowerCase()} turns the ${attack.name.toLowerCase()} back to its caster.` : `The ${attack.name.toLowerCase()} goes through the ${guard.name.toLowerCase()} and strikes its caster.`;
        return R(reflected ? 'reflected' : 'goes through', guardFirst ? guardTakes : attackerTakes, guardFirst ? attackerTakes : guardTakes, line, true);
      }
      const ea = a.elements[0], eb = b.elements[0];
      switch (relationKind(ea, eb)) {
        case 'same': return R('doubled', { [ea]: 1 }, { [ea]: 1 }, `Two ${B}s meet and each goes on to the other caster.`, true);
        case 'beats': return R('overcome', {}, { [ea]: 1 }, `The ${A.toLowerCase()} overcomes the ${B} and goes on to its caster.`, true);
        case 'beaten': return R('overcome', { [eb]: 1 }, {}, `The ${B} overcomes the ${A.toLowerCase()} and goes on to its caster.`, true);
        case 'quench': return R('cancel', {}, {}, `${A} and ${B} undo each other. Nothing lands.`, true);
        default: return R('pass', { [eb]: 1 }, { [ea]: 1 }, `${A} and ${B} pass each other. Both go on.`, true);
      }
    }
    // The reaction for a simple pair, as seen from the first id.
    function reactionFor(aId, bId) {
      const direct = written[`${aId} ${bId}`], flipped = written[`${bId} ${aId}`];
      if (direct) return direct;
      if (flipped) return R(flipped.name, flipped.y, flipped.x, flipped.line);
      return derivedReaction(aId, bId);
    }
    // Rings, blank sheets and fizzles do nothing to the other caster; an attack
    // simply goes on to them, and two of them make a quiet round.
    const isIdle = id => id === 'blank' || id === 'fizzle' || byId[id].kind === 'barrier';
    const landLine = spell => `The ${spell.name.toLowerCase()} finds no answer and goes on.`;
    const marksOf = elements => Object.fromEntries(elements.map(e => [e, 1]));
    const named = e => ELEMENT_NAMES[e];
    // How two elements stand to each other, in words. Used wherever the game
    // has to say why a blow did what it did.
    function sayBecause(a, b) {
      switch (relationKind(a, b)) {
        case 'beats': return `${named(a)} beats ${named(b)}`;
        case 'beaten': return `${named(b)} beats ${named(a)}`;
        case 'quench': return `${named(a)} and ${named(b)} quench each other`;
        case 'pass': return `${named(a)} and ${named(b)} pass through each other`;
        case 'same': return `${named(a)} against ${named(a)}`;
        default: return `nothing between ${named(a)} and ${named(b)}`;
      }
    }
    const BECAUSE_TABLE = {};
    for (const a of ELEMENTS) for (const b of ELEMENTS) BECAUSE_TABLE[`${a} ${b}`] = sayBecause(a, b);
    const because = (a, b) => BECAUSE_TABLE[`${a} ${b}`] || sayBecause(a, b);

    // Two attacks meet on the wheel. Two single elements use the written or
    // derived reaction. A compound brings both its elements and there is
    // still one reaction and one line: a side that beats the other somewhere
    // and is beaten nowhere overcomes, and only its spell goes on; if each
    // has the better of the other somewhere they trade and both go on;
    // otherwise whatever is not quenched goes on.
    function attackReaction(aId, bId) {
      const a = byId[aId], b = byId[bId];
      if (a.elements.length === 1 && b.elements.length === 1) {
        const r = reactionFor(aId, bId);
        return { name: r.name, line: r.line, marksA: r.x, marksB: r.y };
      }
      const A = a.name, B = b.name.toLowerCase();
      const winsA = [], winsB = [];
      for (const ea of a.elements) for (const eb of b.elements) {
        const k = relationKind(ea, eb);
        if (k === 'beats') winsA.push([ea, eb]); else if (k === 'beaten') winsB.push([ea, eb]);
      }
      if (winsA.length && !winsB.length) return { name: 'overcome', line: `The ${A.toLowerCase()} overcomes the ${B} (${because(...winsA[0])}) and goes on to its caster.`, marksA: {}, marksB: marksOf(a.elements) };
      if (winsB.length && !winsA.length) return { name: 'overcome', line: `The ${B} overcomes the ${A.toLowerCase()} (${because(winsB[0][1], winsB[0][0])}) and goes on to its caster.`, marksA: marksOf(b.elements), marksB: {} };
      if (winsA.length && winsB.length) return { name: 'trade', line: `${A} and ${B} each have the better of the other somewhere. Both go on.`, marksA: marksOf(b.elements), marksB: marksOf(a.elements) };
      const quenched = (e, others) => others.some(o => relationKind(e, o) === 'quench');
      const onB = a.elements.filter(e => !quenched(e, b.elements)), onA = b.elements.filter(e => !quenched(e, a.elements));
      if (!onA.length && !onB.length) return { name: 'cancel', line: `${A} and ${B} undo each other. Nothing lands.`, marksA: {}, marksB: {} };
      const lost = onA.length + onB.length < a.elements.length + b.elements.length;
      return { name: 'pass', line: `${A} and ${B} pass each other${lost ? ', less what is quenched' : ''}. Both go on.`, marksA: marksOf(onA), marksB: marksOf(onB) };
    }
    // A guard against a compound: turned back only if it turns back every
    // element, otherwise the whole spell comes through.
    function guardReaction(guardId, attackId) {
      const guard = byId[guardId], attack = byId[attackId];
      const back = attack.elements.every(e => guard.reflects.includes(e));
      const marks = marksOf(attack.elements);
      return back
        ? { name: 'reflected', line: `The ${guard.name.toLowerCase()} turns the ${attack.name.toLowerCase()} back to its caster.`, marksGuard: {}, marksAttacker: marks }
        : { name: 'goes through', line: `The ${attack.name.toLowerCase()} goes through the ${guard.name.toLowerCase()} and strikes its caster.`, marksGuard: marks, marksAttacker: {} };
    }

    function pairReaction(aId, bId) {
      const a = byId[aId], b = byId[bId];
      if (isIdle(aId) && isIdle(bId)) {
        const quiet = aId === 'blank' && bId === 'blank';
        return { name: quiet ? 'quiet' : 'stillness', line: quiet ? 'Neither caster draws. The candles burn down a little.' : 'No blow is struck. Each caster tends to their own ring.', marksA: {}, marksB: {} };
      }
      if (isIdle(aId) || isIdle(bId)) {
        const caster = isIdle(bId) ? a : b;
        if (caster.kind === 'attack') {
          const marks = marksOf(caster.elements);
          return { name: 'goes on', line: landLine(caster), marksA: isIdle(aId) ? marks : {}, marksB: isIdle(bId) ? marks : {} };
        }
        return { name: 'stillness', line: `The ${caster.name.toLowerCase()} guards against nothing.`, marksA: {}, marksB: {} };
      }
      if (a.kind === 'defence' || b.kind === 'defence') {
        if (SIMPLE.includes(aId) && SIMPLE.includes(bId)) { const r = reactionFor(aId, bId); return { name: r.name, line: r.line, marksA: r.x, marksB: r.y }; }
        const guardFirst = a.kind === 'defence';
        const g = guardReaction(guardFirst ? aId : bId, guardFirst ? bId : aId);
        return { name: g.name, line: g.line, marksA: guardFirst ? g.marksGuard : g.marksAttacker, marksB: guardFirst ? g.marksAttacker : g.marksGuard };
      }
      return attackReaction(aId, bId);
    }

    // What each caster has coming at them this round, as strikes: a strike is
    // one spell's elements at that spell's power. An element belongs to the
    // other caster's spell when they cast it, otherwise it is the receiver's
    // own, turned back on them.
    function strikesFor(marks, ownId, otherId, ownPower, otherPower) {
      const other = byId[otherId];
      const fromOther = [], fromOwn = [];
      for (const e of Object.keys(marks)) {
        if (!marks[e]) continue;
        if (other && other.elements.includes(e)) fromOther.push(e); else fromOwn.push(e);
      }
      const order = e => ELEMENTS.indexOf(e);
      const strikes = [];
      if (fromOther.length) strikes.push({ elements: fromOther.sort((p, q) => order(p) - order(q)), power: otherPower, source: 'other' });
      if (fromOwn.length) strikes.push({ elements: fromOwn.sort((p, q) => order(p) - order(q)), power: ownPower, source: 'own' });
      return strikes;
    }
    // A reaction is pure in its ids and powers, and the monster asks for the
    // same few thousand of them over and over, so they are kept once built
    // and handed out as copies.
    const reactionMemo = new Map();
    const copyStrikes = strikes => strikes.map(st => ({ ...st, elements: st.elements.slice() }));
    function reactions(aId, bId, powerA = 1, powerB = 1) {
      if (!byId[aId] || !byId[bId]) throw new Error(`Unknown spell: ${aId} / ${bId}`);
      const key = `${aId} ${bId} ${powerA} ${powerB}`;
      let r = reactionMemo.get(key);
      if (!r) {
        const p = pairReaction(aId, bId);
        r = { name: p.name, line: p.line, strikes: { a: strikesFor(p.marksA, aId, bId, powerA, powerB), b: strikesFor(p.marksB, bId, aId, powerB, powerA) }, powers: [powerA, powerB] };
        reactionMemo.set(key, r);
      }
      return { name: r.name, line: r.line, strikes: { a: copyStrikes(r.strikes.a), b: copyStrikes(r.strikes.b) }, powers: r.powers.slice() };
    }

    // Rings. A ring has elements (none for a bare ward) and a strength, 1 to
    // MAX_RING. Against a strike it is strong when one of its elements beats
    // or quenches the striking element, weak when the strike beats or passes
    // one of them, neutral otherwise. Strong: the strike is turned aside and
    // the ring is untouched. Weak, or no ring at all: the strike goes straight
    // through. Neutral: the ring wears by the strike's power, and a power as
    // high as the ring breaks it and goes through. Getting through is a
    // wound; the power of the strike no longer matters, and HITS wounds kill.
    const noRing = () => ({ elements: [], strength: 0 });
    const emptyBody = () => ({ ring: noRing(), wounds: 0 });
    const RELATION = { strong: 1, neutral: 0, weak: -1 };
    function relation(attack, ringElement) {
      if (!ringElement) return 'neutral';
      switch (relationKind(attack, ringElement)) {
        case 'beaten': case 'quench': return 'strong';
        case 'beats': case 'pass': return 'weak';
        default: return 'neutral';
      }
    }
    const RELATION_NAMES = { strong: 'turns it aside', neutral: 'wears under it', weak: 'is nothing to it' };
    // The ring meets each striking element with its best element, and
    // answers a compound with the better of its answers: a compound is as
    // weak against a ring as its weaker element, the price of meeting other
    // spells with its better one.
    function meet(ring, strike) {
      let best = null;
      for (const attack of strike.elements) {
        let r = 'neutral', against = null;
        for (const e of ring.elements) { const k = relation(attack, e); if (!against || RELATION[k] > RELATION[r]) { r = k; against = e; } }
        if (!best || RELATION[r] > RELATION[best.relation]) best = { element: attack, relation: r, against };
      }
      return best;
    }
    function strikeRing(ring, strike) {
      const { element, relation: r, against } = meet(ring, strike);
      const why = ring.strength && against ? because(against, element) : '';
      if (!ring.strength) return { element, relation: 'neutral', how: 'open', why, through: true, worn: 0, left: 0 };
      if (r === 'strong') return { element, relation: r, how: 'aside', why, through: false, worn: 0, left: ring.strength };
      if (r === 'weak') return { element, relation: r, how: 'pierced', why, through: true, worn: ring.strength, left: 0 };
      if (strike.power >= ring.strength) return { element, relation: r, how: 'broken', why, through: true, worn: ring.strength, left: 0 };
      return { element, relation: r, how: 'worn', why, through: false, worn: strike.power, left: ring.strength - strike.power };
    }
    const isBare = id => byId[id] && byId[id].kind === 'barrier' && !isRing(id);
    function raiseRing(ring, castId, power) {
      const cast = byId[castId];
      const before = { ...ring, elements: ring.elements.slice() };
      if (isBare(castId)) {
        // A bare ring thickens whatever stands, or stands alone.
        return { ring: { elements: ring.elements.slice(), strength: Math.min(MAX_RING, ring.strength + power) }, before };
      }
      const same = ring.elements.length === cast.elements.length && ring.elements.every(e => cast.elements.includes(e));
      if (same) return { ring: { elements: ring.elements.slice(), strength: Math.min(MAX_RING, ring.strength + power) }, before };
      return { ring: { elements: cast.elements.slice(), strength: Math.min(MAX_RING, power) }, before };
    }

    const isCompound = id => Boolean(byId[id]) && byId[id].elements.length > 1;
    const castPower = (id, power) => isCompound(id) ? Math.max(1, power - COMPOUND_COST) : power;

    // One round: rings are raised first, then each strike meets the ring in
    // front of its target, in the order they come. Getting through wounds,
    // and the wound that makes HITS kills. `powers` are as the hands drew
    // them; a compound is cast at less.
    function applyRound(bodyA, bodyB, aId, bId, powers = [1, 1]) {
      const bodies = [bodyA, bodyB].map(body => ({ ring: { ...noRing(), ...(body.ring || {}) }, wounds: body.wounds || 0 })), ids = [aId, bId];
      bodies.forEach(body => { body.ring.elements = (body.ring.elements || []).slice(); });
      const cast = ids.map((id, i) => castPower(id, powers[i]));
      const raised = ids.map((id, i) => {
        if (!(byId[id] && byId[id].kind === 'barrier')) return null;
        const { ring, before } = raiseRing(bodies[i].ring, id, cast[i]);
        bodies[i].ring = ring;
        return { before, after: { ...ring, elements: ring.elements.slice() } };
      });
      const reaction = reactions(aId, bId, cast[0], cast[1]);
      const deaths = [null, null];
      const blows = [reaction.strikes.a, reaction.strikes.b].map((strikes, i) => strikes.map(strike => {
        if (deaths[i]) return { ...strike, element: strike.elements[0], relation: 'neutral', how: 'spent', why: '', through: false, worn: 0, left: 0, spent: true };
        const hit = strikeRing(bodies[i].ring, strike);
        let wound = 0;
        if (hit.through) {
          bodies[i].ring = noRing();
          wound = bodies[i].wounds += 1;
          if (bodies[i].wounds >= HITS) deaths[i] = hit.element;
        } else bodies[i].ring.strength = hit.left;
        if (bodies[i].ring.strength === 0) bodies[i].ring = noRing();
        return { ...strike, ...hit, wound };
      }));
      return { bodies, raised, blows, reaction, deaths };
    }

    // What the other caster is allowed to know: the ring's thickness, never
    // its element; wounds are plain to see.
    const maskBody = body => ({ ring: { elements: body.ring.elements.length ? ['hidden'] : [], strength: body.ring.strength }, wounds: body.wounds || 0 });
    const maskCast = id => isRing(id) ? WARD.id : id;

    // The monster weighs each option against what it believes the player will
    // draw and what it has learnt of the player's ring, leans on its
    // temperament, and sometimes fumbles the glyph.
    const monsters = [
      // Loyal to fire: flame, bolt and magma, and a ring of flame to stand
      // behind. Straying to another element costs it 3, less than a wound,
      // so it does so when fire is clearly the wrong answer; at 6 it lost to
      // a random player on the five-element wheel, where flame is beaten by
      // two elements and turned back by the mirror.
      { id: 'salamander', name: 'the Salamander', line: 'A lizard of embers that loves its own element.', elements: ['fire'], loyalty: 3, bias: { flame: 2, bolt: 1.5, magma: 1, 'ring-flame': 1.5, 'ring-bolt': 1, ward: 1 }, accuracy: .85, precision: [.4, .4, .2], temperature: .9 }
    ];
    const sq = n => n * n;
    function value(result, selfIndex) {
      const otherIndex = 1 - selfIndex, [self, other] = [result.bodies[selfIndex], result.bodies[otherIndex]];
      let v = .9 * (sq(self.ring.strength) - sq(other.ring.strength)) + .6 * (self.ring.elements.length - other.ring.elements.length);
      // A wound is worth a share of a kill, so the monster presses a wounded
      // caster and guards itself once wounded.
      v += 10 / HITS * other.wounds - 14 / HITS * self.wounds;
      if (result.deaths[otherIndex]) v += 10;
      if (result.deaths[selfIndex]) v -= 14;
      return v;
    }
    // What the monster expects the player to draw: a light uniform prior,
    // every past cast, and the last three casts counted three times, so a player
    // who keeps to one spell is answered within a few rounds.
    function belief(history) {
      const counts = Object.fromEntries(OPTIONS.map(id => [id, .5]));
      history.forEach((id, i) => { if (id in counts) counts[id] += i >= history.length - 3 ? 3 : 1; });
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return Object.fromEntries(OPTIONS.map(id => [id, counts[id] / total]));
    }
    // The monster's hand: how often its glyph comes out weak, clean or perfect.
    function monsterPower(monster, random = Math.random) {
      const weights = monster.precision || [1, 0, 0];
      let roll = random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) return i + 1; }
      return weights.length;
    }
    // A monster follows its own elements: an attack, ring or guard that
    // carries none of them costs it its loyalty, so it strays only when
    // nothing of its own can do the job. A bare ward, a blank sheet and a
    // fizzle belong to no element and cost nothing.
    const strays = (monster, id) => {
      if (!monster.elements || !monster.elements.length) return false;
      const spell = byId[id];
      if (!spell || !(spell.kind === 'attack' || spell.kind === 'defence' || isRing(id))) return false;
      return !spell.elements.some(e => monster.elements.includes(e));
    };
    // `other` is what the monster knows of the player: the ring's strength, and
    // its elements only if a strike has revealed them (`known`).
    function scoreOptions(monster, self, other, history, known = null) {
      const guess = belief(history);
      const typical = 2;
      const guesses = known ? [{ elements: known, weight: 1 }] : other.ring.elements.length
        ? ELEMENTS.map(e => ({ elements: [e], weight: 1 / ELEMENTS.length })) : [{ elements: [], weight: 1 }];
      return OPTIONS.map(id => {
        let expected = 0;
        for (const theirs of OPTIONS) {
          for (const g of guesses) {
            const believed = { ring: { elements: g.elements, strength: other.ring.strength }, wounds: other.wounds || 0 };
            const result = applyRound(self, believed, id, theirs, [typical, typical]);
            expected += guess[theirs] * g.weight * value(result, 0);
          }
        }
        return { id, score: expected + (monster.bias[id] || 0) - (strays(monster, id) ? monster.loyalty || 0 : 0) };
      });
    }
    function chooseSpell(monster, self, other, history, random = Math.random, known = null) {
      const scored = scoreOptions(monster, self, other, history, known);
      const t = monster.temperature || 1, top = Math.max(...scored.map(s => s.score));
      const weights = scored.map(s => Math.exp((s.score - top) / t));
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = random() * total, chosen = scored[scored.length - 1].id;
      for (let i = 0; i < scored.length; i++) { roll -= weights[i]; if (roll <= 0) { chosen = scored[i].id; break; } }
      if (chosen !== 'blank' && random() > monster.accuracy) return 'fizzle';
      return chosen;
    }

    return { data, ELEMENTS, elementsById, ELEMENT_NAMES, ELEMENT_COLOURS, DEATHS, ROUND_SECONDS, MAX_POWER, MAX_RING, HITS, COMPOUND_COST, POWER_LEVELS, RELATION_NAMES, powerFor, castPower, isCompound, relations, beats, relationKind, setRelation, spells, rings, ringId, isRing, WARD, BLANK, FIZZLE, OPTIONS, SIMPLE, byId, reactionFor, derivedReaction, reactions, relation, because, strikeRing, raiseRing, applyRound, emptyBody, noRing, maskBody, maskCast, monsters, chooseSpell, monsterPower, scoreOptions, belief };
  }

  // The data file, written back the way it is kept: objects one key per
  // line, lists of numbers (and of number pairs) on one line.
  const flat = v => Array.isArray(v) && v.every(x => typeof x === 'number' || (Array.isArray(x) && x.every(n => typeof n === 'number')));
  function stringify(v, indent = '') {
    const inner = indent + '  ';
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      if (flat(v)) return JSON.stringify(v);
      return '[\n' + v.map(x => inner + stringify(x, inner)).join(',\n') + '\n' + indent + ']';
    }
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (!keys.length) return '{}';
      return '{\n' + keys.map(k => inner + JSON.stringify(k) + ': ' + stringify(v[k], inner)).join(',\n') + '\n' + indent + '}';
    }
    return JSON.stringify(v);
  }
  const serialize = data => `'use strict';

// Glyphs: the elements, how they stand to one another, the spells with their
// glyph shapes, and the reactions written by hand. Pure data; the rules in
// glyphs-spells.js build everything else from it. Edit it in the forge
// (/glyphs-editor.html), which writes this file back, or by hand: the value
// must stay JSON. A pair of attacks with no written reaction gets one derived
// from the relations.
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.GlyphsData = data;
})(typeof self !== 'undefined' ? self : this, ${stringify(data)});
`;
  // Pull the JSON back out of a data file, for the forge's "load a file".
  const parse = text => {
    const start = text.indexOf('{', text.indexOf('typeof self'));
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Not a glyphs data file.');
    return JSON.parse(text.slice(start, end + 1));
  };

  const api = build(DATA);
  return Object.assign(api, { build, validate, serialize, parse, SHAPE_KINDS, shapeParams: kind => SHAPES[kind] ? SHAPES[kind].params : null, strokesOf });
});
