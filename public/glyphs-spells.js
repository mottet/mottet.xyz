'use strict';

// Glyphs: the spells, how they react, and how a caster's body comes apart.
// Pure data and rules. The same file serves the game page, the designer
// grimoire and the Node checks, so it carries no DOM.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlyphsSpells = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const ELEMENTS = ['fire', 'water', 'earth', 'air'];
  const OPPOSITE = { fire: 'water', water: 'fire', earth: 'air', air: 'earth' };
  const CANCELLATIONS = { fire: 'steam', water: 'steam', earth: 'dust', air: 'dust' };
  const DEATH_AT = 3;
  const ROUND_SECONDS = 10;
  // Momentum: the same attack cast in consecutive rounds grows by one mark a
  // round, up to this. Rest, a fizzle or another glyph breaks the run.
  const MAX_POWER = 3;
  const DEATHS = {
    fire: { name: 'burnt to ash', line: 'The fire takes the last of them; ash drifts where a caster stood.' },
    water: { name: 'drowned', line: 'The water closes over them and does not give them back.' },
    earth: { name: 'turned to stone', line: 'The stone climbs to the throat and the caster stands forever.' },
    air: { name: 'scattered', line: 'The wind unpicks them and carries them away as leaves.' }
  };
  const MARK_NAMES = { fire: 'ember', water: 'drop', earth: 'crack', air: 'leaf' };

  // Glyph geometry in a unit box, drawn as the templates for recognition and
  // as the figures in the grimoire. Each spell is a list of strokes.
  const arc = (cx, cy, r, from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + (to - from) * i / steps;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
  const segment = (a, b, steps) => Array.from({ length: steps + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps]);
  const polyline = points => points.slice(1).reduce((out, p, i) => out.concat(segment(points[i], p, 12).slice(1)), [points[0]]);
  const triangle = () => polyline([[.5, .05], [.95, .9], [.05, .9], [.5, .05]]);
  const square = () => polyline([[.08, .08], [.92, .08], [.92, .92], [.08, .92], [.08, .08]]);
  const circle = () => arc(.5, .5, .45, -Math.PI / 2, Math.PI * 1.5, 48);
  const wave = (crests = 2) => Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    return [t, .5 - .22 * Math.sin(t * Math.PI * 2 * crests)];
  });
  const spiral = (turns = 2, sign = 1) => Array.from({ length: 73 }, (_, i) => {
    const t = i / 72, a = sign * t * Math.PI * 2 * turns, r = .05 + .42 * t;
    return [.5 + r * Math.cos(a), .5 + r * Math.sin(a)];
  });
  const upright = () => segment([.5, .05], [.5, .95], 24);
  const bolt = () => polyline([[.66, .04], [.34, .52], [.62, .48], [.34, .96]]);
  const crystal = (tilt = Math.PI / 3) => [upright(), segment([.5 - .45 * Math.sin(tilt), .5 - .45 * Math.cos(tilt)], [.5 + .45 * Math.sin(tilt), .5 + .45 * Math.cos(tilt)], 24), segment([.5 + .45 * Math.sin(tilt), .5 - .45 * Math.cos(tilt)], [.5 - .45 * Math.sin(tilt), .5 + .45 * Math.cos(tilt)], 24)];
  const tendril = (sign = 1) => Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    return [.5 + sign * .3 * Math.sin(t * Math.PI * 2), .05 + .9 * t];
  });
  const cup = () => polyline([[.05, .1], [.95, .1], [.5, .95], [.05, .1]]);

  const spells = [
    { id: 'flame', name: 'Flame', element: 'fire', kind: 'attack', glyph: 'a triangle, apex up', flavour: 'The old sign for fire: a point rising from a broad base.', strokes: [triangle()], variants: [[triangle()]] },
    { id: 'wave', name: 'Wave', element: 'water', kind: 'attack', glyph: 'a wave of two crests, drawn across', flavour: 'Water moves in crests; two are enough to call it.', strokes: [wave(2)], variants: [[wave(2)], [wave(3)], [wave(1.5)]] },
    { id: 'stone', name: 'Stone', element: 'earth', kind: 'attack', glyph: 'a square', flavour: 'Earth is a block with four corners and no give.', strokes: [square()], variants: [[square()]] },
    { id: 'wind', name: 'Wind', element: 'air', kind: 'attack', glyph: 'a spiral of two turns', flavour: 'Air is a gust that winds outward from stillness.', strokes: [spiral(2, 1)], variants: [[spiral(2, 1)], [spiral(2, -1)], [spiral(2.5, 1)], [spiral(2.5, -1)]] },
    { id: 'ward', name: 'Ward', element: null, kind: 'defence', glyph: 'a circle', flavour: 'A closed ring on the floor. What comes along the ground breaks on it and goes back; what flies leaps it.', strokes: [circle()], variants: [[circle()]] },
    { id: 'mirror', name: 'Mirror', element: null, kind: 'defence', glyph: 'one upright stroke', flavour: 'A still, upright pane. What flies comes back off it; what is heavy soaks or shatters it.', strokes: [upright()], variants: [[upright()]] },
    // Compound spells join two elements. They react as both of their parts
    // would, one after the other, and land both marks when unanswered.
    { id: 'bolt', name: 'Bolt', element: null, elements: ['fire', 'air'], kind: 'attack', glyph: 'a lightning stroke, two sharp turns', flavour: 'Fire riding the air. It strikes as flame and as wind at once.', strokes: [bolt()], variants: [[bolt()]] },
    { id: 'frost', name: 'Frost', element: null, elements: ['water', 'air'], kind: 'attack', glyph: 'a snow crystal: three strokes crossing at one point', flavour: 'Water carried on the wind until it hardens. Six arms, like the crystal.', strokes: crystal(), variants: [crystal(), crystal(Math.PI / 4)] },
    { id: 'vine', name: 'Vine', element: null, elements: ['earth', 'water'], kind: 'attack', glyph: 'an S, a tendril climbing', flavour: 'Earth drinking water and growing. It binds as stone and as flood.', strokes: [tendril(1)], variants: [[tendril(1)], [tendril(-1)]] },
    { id: 'magma', name: 'Magma', element: null, elements: ['fire', 'earth'], kind: 'attack', glyph: 'a triangle, apex down', flavour: 'Fire turned to the ground until the ground runs. Flame and stone together.', strokes: [cup()], variants: [[cup()]] }
  ];
  spells.forEach(spell => { if (!spell.elements) spell.elements = spell.element ? [spell.element] : []; });
  const SINGLE = { fire: 'flame', water: 'wave', earth: 'stone', air: 'wind' };
  const REST = { id: 'rest', name: 'Rest', element: null, elements: [], kind: 'rest', glyph: 'a blank sheet', flavour: 'Draw nothing. The body settles by one mark, and stands open.' };
  const FIZZLE = { id: 'fizzle', name: 'Fizzle', element: null, elements: [], kind: 'fizzle', glyph: 'a drawing that is no glyph', flavour: 'The ink smoulders and nothing comes of it. No rest, either.' };
  const OPTIONS = spells.map(s => s.id).concat('rest');
  const byId = Object.fromEntries(spells.concat(REST, FIZZLE).map(s => [s.id, s]));

  // Reactions between two cast glyphs, keyed by an unordered pair of ids.
  // `x` are the marks taken by the caster of the first id, `y` by the second.
  const R = (name, x, y, line) => ({ name, x, y, line });
  const stillness = R('stillness', {}, {}, 'Two guards and no blow. Nothing moves.');
  const table = {
    'flame flame': R('inferno', { fire: 1 }, { fire: 1 }, 'Two flames meet and the air itself burns. Both casters take fire.'),
    'flame wave': R('steam', {}, {}, 'Fire and water meet in a hiss of steam. Nothing lands.'),
    'flame stone': R('lava', {}, { fire: 1 }, 'The flame melts the stone, and the molten rock rolls back on its caster.'),
    'flame wind': R('fanned', { fire: 1 }, {}, 'The wind fans the flame back onto the one who lit it.'),
    'flame ward': R('leaps the ring', {}, { fire: 1 }, 'The flame leaps the ring on the floor and lands.'),
    'flame mirror': R('reflected', { fire: 1 }, {}, 'The mirror turns the flame back on its caster.'),
    'wave wave': R('flood', { water: 1 }, { water: 1 }, 'Two waves meet and the floor floods. Both casters take water.'),
    'wave stone': R('mud', { earth: 1 }, {}, 'The stone drinks the wave and slides back as mud onto the water caster.'),
    'wave wind': R('rain', {}, { water: 1 }, 'The wind carries the wave up and it comes down as rain on the wind caster.'),
    'wave ward': R('breaks back', { water: 1 }, {}, 'The wave breaks on the ring and falls back on its caster.'),
    'wave mirror': R('flows through', {}, { water: 1 }, 'Water finds its way round the mirror and soaks its caster.'),
    'stone stone': R('quake', { earth: 1 }, { earth: 1 }, 'Two stones strike and the ground cracks under both casters.'),
    'stone wind': R('pass', { air: 1 }, { earth: 1 }, 'Heavy and light pass each other. Both land.'),
    'stone ward': R('splits back', { earth: 1 }, {}, 'The stone strikes the ring and splits back on its caster.'),
    'stone mirror': R('shatters', {}, { earth: 1 }, 'The stone shatters the mirror and strikes its caster.'),
    'wind wind': R('gale', { air: 1 }, { air: 1 }, 'Two gusts become a gale that tears at both casters.'),
    'wind ward': R('leaps the ring', {}, { air: 1 }, 'The wind leaps the ring on the floor and lands.'),
    'wind mirror': R('reflected', { air: 1 }, {}, 'The mirror turns the wind back to its caster.'),
    'ward ward': stillness,
    'ward mirror': stillness,
    'mirror mirror': stillness
  };
  const isIdle = id => id === 'rest' || id === 'fizzle';
  const landLine = spell => `The ${spell.name.toLowerCase()} finds no answer and lands.`;

  const nextStreak = (streak, id) => {
    const spell = byId[id];
    if (!spell || spell.kind !== 'attack') return { id: null, n: 0 };
    return { id, n: streak && streak.id === id ? streak.n + 1 : 1 };
  };
  const powerOf = streak => Math.max(1, Math.min(MAX_POWER, streak ? streak.n : 1));

  // A mark is as strong as the spell of its element; when both cast that
  // element, each takes the other's. Reflections and fanned flames therefore
  // return a caster's own momentum against them.
  function scaleMarks(marks, ownId, ownPower, otherId, otherPower) {
    const out = {};
    for (const e of Object.keys(marks)) {
      const other = byId[otherId], own = byId[ownId];
      const power = other && other.elements.includes(e) ? otherPower : own && own.elements.includes(e) ? ownPower : 1;
      out[e] = marks[e] * power;
    }
    return out;
  }

  const addMarks = (into, marks) => { for (const e of Object.keys(marks)) into[e] = (into[e] || 0) + marks[e]; return into; };
  // Reactions between single spells, guards and idleness come from the table;
  // a compound reacts as each of its parts in turn and the marks add up.
  function simpleReaction(aId, bId) {
    const a = byId[aId], b = byId[bId];
    if (isIdle(aId) && isIdle(bId)) return { name: 'quiet', line: 'Neither caster draws. The candles burn down a little.', marksA: {}, marksB: {} };
    if (isIdle(aId) || isIdle(bId)) {
      const caster = isIdle(bId) ? a : b;
      if (caster.kind === 'attack') {
        const marks = Object.fromEntries(caster.elements.map(e => [e, 1]));
        return { name: 'lands', line: landLine(caster), marksA: isIdle(aId) ? marks : {}, marksB: isIdle(bId) ? marks : {} };
      }
      return { name: 'stillness', line: `The ${caster.name.toLowerCase()} guards against nothing.`, marksA: {}, marksB: {} };
    }
    const direct = table[`${aId} ${bId}`], flipped = table[`${bId} ${aId}`];
    const r = direct || flipped;
    return { name: r.name, line: r.line, marksA: direct ? r.x : r.y, marksB: direct ? r.y : r.x };
  }
  const partsOf = id => byId[id].elements.length > 1 ? byId[id].elements.map(e => SINGLE[e]) : [id];
  function reactions(aId, bId, powerA = 1, powerB = 1) {
    const a = byId[aId], b = byId[bId];
    if (!a || !b) throw new Error(`Unknown spell: ${aId} / ${bId}`);
    const parts = [];
    for (const pa of partsOf(aId)) for (const pb of partsOf(bId)) parts.push(simpleReaction(pa, pb));
    const marksA = {}, marksB = {};
    parts.forEach(part => { addMarks(marksA, part.marksA); addMarks(marksB, part.marksB); });
    const names = [...new Set(parts.map(p => p.name))].sort();
    const name = names.join(' and ');
    const line = parts.length === 1 ? parts[0].line : [...new Set(parts.map(p => p.line))].sort().join(' ');
    return { name, line, parts: names, marks: { a: scaleMarks(marksA, aId, powerA, bId, powerB), b: scaleMarks(marksB, bId, powerB, aId, powerA) }, powers: [powerA, powerB] };
  }

  const emptyBody = () => ({ fire: 0, water: 0, earth: 0, air: 0 });
  const heaviest = body => ELEMENTS.reduce((best, e) => body[e] > (best ? body[best] : 0) ? e : best, null);

  // One round: rest heals first, the reaction lands, opposite marks cancel,
  // then any element at the threshold kills.
  function applyRound(bodyA, bodyB, aId, bId, powers = [1, 1]) {
    const bodies = [{ ...bodyA }, { ...bodyB }], ids = [aId, bId];
    const heals = ids.map((id, i) => {
      if (id !== 'rest') return null;
      const e = heaviest(bodies[i]);
      if (e) bodies[i][e] -= 1;
      return e;
    });
    const reaction = reactions(aId, bId, powers[0], powers[1]);
    [reaction.marks.a, reaction.marks.b].forEach((marks, i) => ELEMENTS.forEach(e => { bodies[i][e] += marks[e] || 0; }));
    const cancellations = bodies.map(body => {
      const out = [];
      for (const pair of [['fire', 'water'], ['earth', 'air']]) {
        const n = Math.min(body[pair[0]], body[pair[1]]);
        if (n > 0) { body[pair[0]] -= n; body[pair[1]] -= n; out.push({ name: CANCELLATIONS[pair[0]], count: n }); }
      }
      return out;
    });
    const deaths = bodies.map(body => ELEMENTS.find(e => body[e] >= DEATH_AT) || null);
    return { bodies, heals, reaction, cancellations, deaths };
  }

  // The monster weighs each option against what it believes the player will
  // draw, leans on its temperament, and sometimes fumbles the glyph.
  const monsters = [
    { id: 'salamander', name: 'the Salamander', line: 'A lizard of embers that loves its own element.', bias: { flame: .9, bolt: .5, wind: .2, mirror: .1 }, accuracy: .85, temperature: .9 }
  ];
  const sq = n => n * n;
  function value(result, selfIndex) {
    const otherIndex = 1 - selfIndex, [self, other] = [result.bodies[selfIndex], result.bodies[otherIndex]];
    const load = body => ELEMENTS.reduce((sum, e) => sum + sq(body[e]), 0);
    let v = load(other) - 1.3 * load(self);
    if (result.deaths[otherIndex]) v += 10;
    if (result.deaths[selfIndex]) v -= 14;
    return v;
  }
  function belief(history) {
    const counts = Object.fromEntries(OPTIONS.map(id => [id, 2]));
    history.forEach(id => { if (id in counts) counts[id] += 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.fromEntries(OPTIONS.map(id => [id, counts[id] / total]));
  }
  function scoreOptions(monster, self, other, history, streaks = {}) {
    const guess = belief(history);
    return OPTIONS.map(id => {
      let expected = 0;
      const ownPower = powerOf(nextStreak(streaks.self, id));
      for (const theirs of OPTIONS) {
        const result = applyRound(self, other, id, theirs, [ownPower, powerOf(nextStreak(streaks.other, theirs))]);
        expected += guess[theirs] * value({ bodies: result.bodies, deaths: result.deaths }, 0);
      }
      return { id, score: expected + (monster.bias[id] || 0) };
    });
  }
  function chooseSpell(monster, self, other, history, random = Math.random, streaks = {}) {
    const scored = scoreOptions(monster, self, other, history, streaks);
    const t = monster.temperature || 1, top = Math.max(...scored.map(s => s.score));
    const weights = scored.map(s => Math.exp((s.score - top) / t));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = random() * total, chosen = scored[scored.length - 1].id;
    for (let i = 0; i < scored.length; i++) { roll -= weights[i]; if (roll <= 0) { chosen = scored[i].id; break; } }
    if (chosen !== 'rest' && random() > monster.accuracy) return 'fizzle';
    return chosen;
  }

  return { ELEMENTS, OPPOSITE, CANCELLATIONS, DEATH_AT, DEATHS, MARK_NAMES, ROUND_SECONDS, MAX_POWER, nextStreak, powerOf, spells, REST, FIZZLE, OPTIONS, byId, reactions, applyRound, emptyBody, heaviest, monsters, chooseSpell, scoreOptions, belief };
});
