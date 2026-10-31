'use strict';

// Glyphs checks. `--unit` runs the rules, recogniser and a balance simulation
// in Node alone; without it the browser check follows, against a running
// server (HOUSE_BASE_URL, default http://127.0.0.1:8080) with Playwright
// resolved from HOUSE_TEST_TOOLS.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const S = require('../public/glyphs-spells.js');
const R = require('../public/glyphs-recognizer.js');

function unit() {
  // Every reaction is the mirror of its reverse.
  const all = S.OPTIONS.concat('fizzle');
  for (const a of all) for (const b of all) {
    const ab = S.reactions(a, b), ba = S.reactions(b, a);
    assert.equal(ab.name, ba.name, `${a}/${b} name`);
    assert.deepEqual(ab.strikes.a, ba.strikes.b, `${a}/${b} strikes`);
    assert.deepEqual(ab.strikes.b, ba.strikes.a, `${a}/${b} strikes`);
  }
  // The four-cycle and the diagonals, as strikes going on to a caster.
  const goesTo = (r, side) => r.strikes[side].map(st => st.elements.join('+') + (st.source === 'own' ? '!' : ''));
  assert.deepEqual(goesTo(S.reactions('flame', 'stone'), 'b'), ['fire']);
  assert.deepEqual(goesTo(S.reactions('stone', 'wave'), 'b'), ['earth']);
  assert.deepEqual(goesTo(S.reactions('wave', 'wind'), 'b'), ['water']);
  assert.deepEqual(goesTo(S.reactions('wind', 'flame'), 'b'), ['air'], 'fanned: the loser is struck by the winner\'s element, as everywhere on the wheel');
  assert.equal(S.reactions('flame', 'wave').name, 'steam');
  assert.deepEqual([goesTo(S.reactions('stone', 'wind'), 'a'), goesTo(S.reactions('stone', 'wind'), 'b')], [['air'], ['earth']]);
  assert.deepEqual(goesTo(S.reactions('mirror', 'flame'), 'b'), ['fire!']);
  assert.deepEqual(goesTo(S.reactions('mirror', 'stone'), 'a'), ['earth']);
  // A compound strikes as one blow of two elements; its power is one number.
  assert.deepEqual(S.reactions('bolt', 'blank', 2, 1).strikes.b, [{ elements: ['fire', 'air'], power: 2, source: 'other' }]);
  // One reaction and one line whatever meets: the better element decides.
  assert.equal(S.reactions('bolt', 'stone').name, 'overcome');
  assert.deepEqual([goesTo(S.reactions('bolt', 'stone'), 'a'), goesTo(S.reactions('bolt', 'stone'), 'b')], [[], ['fire+air']], 'the bolt overcomes the stone and the whole bolt goes on');
  assert.equal(S.reactions('bolt', 'stone').line, 'The bolt overcomes the stone (flame beats stone) and goes on to its caster.');
  assert.equal(S.reactions('bolt', 'frost').name, 'overcome'); assert.deepEqual(goesTo(S.reactions('bolt', 'frost'), 'a'), ['water+air'], 'frost beats bolt: water over wind, wind over flame');
  assert.equal(S.reactions('bolt', 'vine').name, 'trade'); assert.deepEqual([goesTo(S.reactions('bolt', 'vine'), 'a'), goesTo(S.reactions('bolt', 'vine'), 'b')], [['water+earth'], ['fire+air']], 'each has the better of the other somewhere: both go on');
  assert.deepEqual(goesTo(S.reactions('bolt', 'mirror'), 'a'), ['fire+air!'], 'a mirror turns back a bolt, both elements of which it reflects');
  assert.deepEqual(goesTo(S.reactions('magma', 'mirror'), 'b'), ['fire+earth'], 'stone shatters the mirror, so the whole magma goes through');
  assert.ok(!S.reactions('bolt', 'stone').line.includes('  ') && S.reactions('magma', 'frost').line.split('. ').length <= 2, 'one line per round');
  // The price of a compound: cast one power below the hand, never below 1.
  assert.equal(S.COMPOUND_COST, 1);
  assert.equal(S.castPower('bolt', 3), 2); assert.equal(S.castPower('bolt', 1), 1); assert.equal(S.castPower('flame', 3), 3); assert.equal(S.castPower('ring-bolt', 3), 2);
  const c1 = S.applyRound(S.emptyBody(), { ring: { elements: [], strength: 3 } }, 'bolt', 'blank', [3, 1]);
  assert.deepEqual(c1.deaths, [null, null], 'a perfect bolt cannot break a full bare ward'); assert.equal(c1.bodies[1].ring.strength, 1); assert.deepEqual(c1.reaction.powers, [2, 1]);
  const c2 = S.applyRound(S.emptyBody(), { ring: { elements: [], strength: 3 } }, 'flame', 'blank', [3, 1]);
  assert.deepEqual(c2.deaths, [null, 'fire'], 'a perfect flame does');
  const c3 = S.applyRound(S.emptyBody(), S.emptyBody(), 'ring-bolt', 'blank', [3, 1]);
  assert.equal(c3.bodies[0].ring.strength, 2, 'a ring of a compound is raised at the compound\'s power');
  // Precision is power.
  assert.equal(S.powerFor(.3), 3); assert.equal(S.powerFor(.7), 2); assert.equal(S.powerFor(1.2), 1);
  // No ring: any strike kills by its element.
  let r = S.applyRound(S.emptyBody(), S.emptyBody(), 'flame', 'blank', [1, 1]);
  assert.deepEqual(r.deaths, [null, 'fire']);
  // Relations: the cycle, the quench, the pass.
  assert.equal(S.relation('fire', 'water'), 'strong'); assert.equal(S.relation('water', 'fire'), 'strong');
  assert.equal(S.relation('fire', 'earth'), 'weak'); assert.equal(S.relation('earth', 'fire'), 'strong');
  assert.equal(S.relation('earth', 'air'), 'weak'); assert.equal(S.relation('air', 'earth'), 'weak');
  assert.equal(S.relation('fire', 'fire'), 'neutral'); assert.equal(S.relation('fire', null), 'neutral');
  // A ring turns a strike aside, is pierced, breaks or wears; getting through is death.
  const ring = (elements, strength) => ({ ring: { elements, strength } });
  r = S.applyRound(S.emptyBody(), ring(['water'], 1), 'flame', 'blank', [3, 1]);
  assert.deepEqual(r.deaths, [null, null], 'a thin ring of water turns aside a perfect flame');
  assert.equal(r.blows[1][0].how, 'aside'); assert.equal(r.blows[1][0].why, 'water and flame quench each other');
  assert.equal(r.bodies[1].ring.strength, 1, 'a ring that turns a strike aside is untouched');
  r = S.applyRound(S.emptyBody(), ring(['earth'], 3), 'flame', 'blank', [1, 1]);
  assert.deepEqual(r.deaths, [null, 'fire'], 'a full ring of stone is nothing to the weakest flame');
  assert.equal(r.blows[1][0].how, 'pierced'); assert.equal(r.blows[1][0].why, 'flame beats stone');
  r = S.applyRound(S.emptyBody(), ring([], 3), 'flame', 'blank', [3, 1]);
  assert.deepEqual(r.deaths, [null, 'fire'], 'a full bare ward breaks under a perfect attack');
  assert.equal(r.blows[1][0].how, 'broken'); assert.equal(r.blows[1][0].why, '');
  r = S.applyRound(S.emptyBody(), ring([], 3), 'flame', 'blank', [2, 1]);
  assert.deepEqual(r.deaths, [null, null]); assert.equal(r.bodies[1].ring.strength, 1); assert.equal(r.blows[1][0].how, 'worn');
  r = S.applyRound(S.emptyBody(), ring(['fire'], 3), 'flame', 'blank', [2, 1]);
  assert.equal(r.blows[1][0].how, 'worn'); assert.equal(r.blows[1][0].why, 'flame against flame'); assert.equal(r.bodies[1].ring.strength, 1, 'an element against its own ring wears it');
  r = S.applyRound(S.emptyBody(), S.emptyBody(), 'flame', 'blank', [1, 1]);
  assert.equal(r.blows[1][0].how, 'open');
  // A ring answers a compound with the better of its answers.
  r = S.applyRound(S.emptyBody(), ring(['fire'], 2), 'bolt', 'blank', [2, 1]);
  assert.equal(r.blows[1][0].element, 'fire', 'a ring of fire answers a bolt as flame against flame, not as the wind it cannot resist');
  assert.equal(r.blows[1][0].how, 'worn'); assert.deepEqual(r.deaths, [null, null]); assert.equal(r.bodies[1].ring.strength, 1, 'worn by the bolt\'s power, one below the hand');
  r = S.applyRound(S.emptyBody(), ring(['water'], 1), 'bolt', 'blank', [3, 1]);
  assert.equal(r.blows[1][0].how, 'aside', 'a ring of water turns a bolt aside: it answers either element');
  r = S.applyRound(S.emptyBody(), ring(['earth'], 3), 'bolt', 'blank', [1, 1]);
  assert.equal(r.blows[1][0].how, 'pierced'); assert.deepEqual(r.deaths, [null, 'fire'], 'a bolt goes straight through a ring of stone, which neither flame nor wind respects');
  // Raising rings: a bare ward thickens, the same element thickens, another replaces, never beyond the cap.
  r = S.applyRound(ring(['water'], 2), S.emptyBody(), 'ward', 'blank', [3, 1]);
  assert.deepEqual(r.bodies[0].ring, { elements: ['water'], strength: S.MAX_RING });
  r = S.applyRound(ring(['water'], 1), S.emptyBody(), 'ring-wave', 'blank', [1, 1]);
  assert.deepEqual(r.bodies[0].ring, { elements: ['water'], strength: 2 });
  r = S.applyRound(ring(['water'], 3), S.emptyBody(), 'ring-flame', 'blank', [2, 1]);
  assert.deepEqual(r.bodies[0].ring, { elements: ['fire'], strength: 2 });
  r = S.applyRound(S.emptyBody(), S.emptyBody(), 'ring-wave', 'flame', [3, 2]);
  assert.deepEqual(r.deaths, [null, null], 'a ring raised this round stands against this round\'s blow');
  assert.deepEqual(r.bodies[0].ring, { elements: ['water'], strength: 3 }, 'water quenches flame: the ring is untouched');
  // The mirror sends a perfect flame back into its caster's own ring.
  r = S.applyRound(ring(['earth'], 3), S.emptyBody(), 'flame', 'mirror', [3, 1]);
  assert.deepEqual(r.deaths, ['fire', null], 'a reflected perfect flame eats through its caster\'s own ring of stone');
  r = S.applyRound(ring(['air'], 3), S.emptyBody(), 'flame', 'mirror', [3, 1]);
  assert.deepEqual(r.deaths, [null, null], 'a ring of wind turns the reflected flame aside');
  // Masks: the other caster sees thickness only.
  assert.deepEqual(S.maskBody(ring(['fire'], 2)), { ring: { elements: ['hidden'], strength: 2 } });
  assert.equal(S.maskCast('ring-flame'), 'ward'); assert.equal(S.maskCast('flame'), 'flame');
  // Both can fall at once.
  r = S.applyRound(S.emptyBody(), S.emptyBody(), 'stone', 'stone');
  assert.deepEqual(r.deaths, ['earth', 'earth']);
  console.log('PASS rules: symmetric matrix, four-cycle, diagonals, mirror, compounds as one reaction and one blow, precision, relations, rings turned aside, pierced, broken and worn, raising rings, masks, deaths');

  // The data file builds the rules; the forge can build others from it.
  assert.deepEqual(S.validate(S.data), []);
  assert.equal(S.serialize(S.data), require('node:fs').readFileSync(path.join(__dirname, '..', 'public', 'glyphs-data.js'), 'utf8'), 'the data file is written the way serialize writes it');
  assert.deepEqual(S.parse(S.serialize(S.data)), S.data);
  const fork = () => JSON.parse(JSON.stringify(S.data));
  let d = fork(); d.elements.push({ ...d.elements[0] });
  assert.ok(S.validate(d).some(p => /used twice/.test(p)));
  d = fork(); d.relations.push({ kind: 'beats', from: 'earth', to: 'fire' });
  assert.ok(S.validate(d).some(p => /already have a relation/.test(p)));
  d = fork(); d.spells = d.spells.filter(s => s.id !== 'ward');
  assert.ok(S.validate(d).some(p => /exactly one barrier/.test(p)));
  d = fork(); d.spells[0].shapes = [{ kind: 'blob' }];
  assert.ok(S.validate(d).some(p => /kind must be one of/.test(p)));
  d = fork(); d.reactions['flame flame'].x = { smoke: 1 };
  assert.ok(S.validate(d).some(p => /not an element/.test(p)));
  // A pair with no written reaction follows the wheel.
  d = fork(); for (const key of ['flame stone', 'flame wave', 'stone wind', 'flame mirror', 'stone mirror']) delete d.reactions[key];
  let T = S.build(d);
  assert.equal(T.reactionFor('flame', 'stone').derived, true); assert.equal(S.reactionFor('flame', 'stone').derived, false);
  assert.deepEqual(goesTo(T.reactions('flame', 'stone'), 'b'), ['fire'], 'flame beats stone: the stone caster takes fire');
  assert.deepEqual(goesTo(T.reactions('stone', 'flame'), 'a'), ['fire']);
  assert.equal(T.reactions('flame', 'wave').name, 'cancel');
  assert.deepEqual([goesTo(T.reactions('stone', 'wind'), 'a'), goesTo(T.reactions('stone', 'wind'), 'b')], [['air'], ['earth']]);
  assert.deepEqual(goesTo(T.reactions('flame', 'mirror'), 'a'), ['fire!'], 'the mirror reflects what it is told to');
  assert.deepEqual(goesTo(T.reactions('stone', 'mirror'), 'b'), ['earth']);
  // Turning a relation turns the ring relations with it.
  d = fork(); d.relations = S.setRelation('fire', 'earth', 'beaten'); T = S.build(d);
  assert.equal(T.relationKind('fire', 'earth'), 'beaten'); assert.equal(T.relation('fire', 'earth'), 'strong'); assert.equal(T.relation('earth', 'fire'), 'weak');
  d.relations = S.setRelation('fire', 'earth', 'none'); delete d.reactions['flame stone']; T = S.build(d);
  assert.equal(T.relation('fire', 'earth'), 'neutral'); assert.equal(T.reactions('flame', 'stone').name, 'pass');
  // A fifth element and a spell for it: the matrix stays symmetric, its ring works, the wheel draws it.
  d = fork();
  d.elements.push({ id: 'metal', name: 'iron', color: '#9aa0a8', death: { name: 'cut down', line: 'The iron finds them.' } });
  d.relations.push({ kind: 'beats', from: 'metal', to: 'earth' }, { kind: 'beats', from: 'fire', to: 'metal' });
  d.spells.push({ id: 'blade', name: 'Blade', elements: ['metal'], kind: 'attack', glyph: 'a slash', flavour: 'Iron drawn across.', shapes: [{ kind: 'polyline', points: [[.1, .9], [.9, .1]] }] });
  T = S.build(d);
  assert.ok(T.OPTIONS.includes('blade') && T.OPTIONS.includes('ring-blade'));
  for (const a of T.OPTIONS.concat('fizzle')) for (const b of T.OPTIONS.concat('fizzle')) assert.deepEqual(T.reactions(a, b).strikes.a, T.reactions(b, a).strikes.b, `${a}/${b}`);
  assert.deepEqual(goesTo(T.reactions('blade', 'stone'), 'b'), ['metal']);
  assert.deepEqual(T.applyRound(T.emptyBody(), { ring: { elements: ['earth'], strength: 2 } }, 'blade', 'blank', [2, 1]).deaths, [null, 'metal'], 'iron beats stone: a ring of stone gives way to a clean blade');
  assert.deepEqual(T.applyRound(T.emptyBody(), { ring: { elements: ['water'], strength: 3 } }, 'blade', 'blank', [2, 1]).deaths, [null, null], 'nothing between iron and water: the ring takes the blow');
  assert.equal(T.maskCast('ring-blade'), 'ward');
  const Wh = require('../public/glyphs-wheel.js');
  const svg = Wh.svg(T, { id: 't' });
  assert.equal((svg.match(/class="wheel-node/g) || []).length, 5); assert.equal((svg.match(/wheel-beats/g) || []).length, 6);
  assert.match(Wh.legend(T), /Iron<\/strong> beats stone/);
  console.log('PASS data: validation, derived reactions, turning relations, a fifth element with its spell and ring, the wheel');

  // The recogniser against a synthetic hand: rotation, squeeze, shear and a
  // slow wobble along the stroke, at mild to strong levels.
  const templates = S.spells.flatMap(s => s.variants.map(v => ({ id: s.id, strokes: v })));
  const prepared = R.prepare(templates);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;
  const hand = (strokes, level) => {
    const rot = gauss() * .06 * level, sx = 1 + gauss() * .12 * level, sy = 1 + gauss() * .12 * level, shear = gauss() * .08 * level;
    const ph = [rnd() * 6.28, rnd() * 6.28], amp = [.025 * level * rnd(), .025 * level * rnd()], fr = [1 + rnd() * 2, 1 + rnd() * 2];
    return strokes.map(stroke => stroke.map(([x, y], i) => {
      const u = i / stroke.length;
      let px = (x - .5) * sx, py = (y - .5) * sy;
      px += shear * py;
      const c = Math.cos(rot), s = Math.sin(rot);
      return [px * c - py * s + .5 + gauss() * .005 * level + amp[0] * Math.sin(u * 6.28 * fr[0] + ph[0]), px * s + py * c + .5 + gauss() * .005 * level + amp[1] * Math.sin(u * 6.28 * fr[1] + ph[1])];
    }));
  };
  for (const [lo, hi, minAccuracy, minAccepted] of [[.5, 1, .98, .85], [1, 1.5, .95, .7]]) {
    let ok = 0, accepted = 0, n = 0;
    for (const spell of S.spells) for (let k = 0; k < 200; k++) {
      const best = R.recognize(hand(spell.strokes, lo + rnd() * (hi - lo)), prepared)[0];
      n++;
      if (best.id === spell.id) { ok++; if (best.distance <= R.ACCEPT) accepted++; }
    }
    assert.ok(ok / n >= minAccuracy, `accuracy at level ${lo}-${hi}: ${(ok / n).toFixed(3)}`);
    assert.ok(accepted / n >= minAccepted, `accepted at level ${lo}-${hi}: ${(accepted / n).toFixed(3)}`);
    console.log(`PASS recogniser level ${lo}-${hi}: ${(ok / n * 100).toFixed(1)}% right, ${(accepted / n * 100).toFixed(1)}% accepted`);
  }
  let scribblesAccepted = 0;
  for (let k = 0; k < 400; k++) {
    const pts = []; let x = .5, y = .5, a = rnd() * 6.28;
    for (let i = 0; i < 60; i++) { a += gauss() * .5; x += Math.cos(a) * .03; y += Math.sin(a) * .03; pts.push([x, y]); }
    if (R.recognize([pts], prepared)[0].distance <= R.ACCEPT) scribblesAccepted++;
  }
  assert.ok(scribblesAccepted / 400 <= .05, `scribbles accepted: ${scribblesAccepted}/400`);
  console.log(`PASS recogniser rejects scribbles (${scribblesAccepted}/400 accepted)`);
  // A triangle drawn apex down is not Flame, and a horizontal line is not Mirror.
  const flipped = S.byId.flame.strokes.map(s => s.map(([x, y]) => [x, 1 - y]));
  assert.notEqual(R.recognize(flipped, prepared)[0].id === 'flame' && R.recognize(flipped, prepared)[0].distance <= R.ACCEPT, true);
  const flat = [[[.1, .5], [.5, .5], [.9, .5]]];
  const flatBest = R.recognize(flat, prepared)[0];
  assert.ok(!(flatBest.id === 'mirror' && flatBest.distance <= R.ACCEPT), 'a flat line is no mirror');
  console.log('PASS recogniser: orientation matters');
  const ringed = [S.byId.ward.strokes[0].map(([x, y]) => [x * 1.4 - .2, y * 1.4 - .2])].concat(S.byId.flame.strokes.map(st => st.map(([x, y]) => [.25 + x * .5, .25 + y * .5])));
  const split = R.splitRing(ringed);
  assert.ok(split.ring, 'the circle round a triangle is the ring');
  assert.equal(R.recognize(split.inner, prepared)[0].id, 'flame');
  assert.equal(R.splitRing(S.byId.frost.strokes).ring, null, 'a crystal has no ring');
  console.log('PASS recogniser: a glyph inside a circle splits into ring and glyph');

  // Balance: each option against a uniform opponent and the monster against
  // a uniform player, so the numbers are there to read after play.
  const duel = (pickA, pickB) => {
    let a = S.emptyBody(), b = S.emptyBody(), round = 0;
    const history = [];
    const monsterHand = S.monsters[0];
    while (round < 60) {
      round++;
      const ia = pickA(a, b, history), ib = pickB(b, a, history);
      const r = S.applyRound(a, b, ia, ib, [S.monsterPower(monsterHand, rnd), S.monsterPower(monsterHand, rnd)]);
      a = r.bodies[0]; b = r.bodies[1]; history.push(ib);
      if (r.deaths[0] || r.deaths[1]) return r.deaths[0] && r.deaths[1] ? 'both' : r.deaths[0] ? 'b' : 'a';
    }
    return 'draw';
  };
  const monster = S.monsters[0];
  const uniform = () => S.OPTIONS[Math.floor(rnd() * S.OPTIONS.length)];
  const casts = {};
  const aiPick = (self, other, history) => { const id = S.chooseSpell(monster, self, S.maskBody(other), history, rnd); casts[id] = (casts[id] || 0) + 1; return id; };
  const lines = [];
  for (const id of S.OPTIONS) {
    const tally = { a: 0, b: 0, both: 0, draw: 0 };
    for (let k = 0; k < 2000; k++) tally[duel(() => id, uniform)]++;
    lines.push(`${S.byId[id].name.padEnd(7)} always: wins ${(tally.a / 20).toFixed(1)}%  loses ${(tally.b / 20).toFixed(1)}%  both ${(tally.both / 20).toFixed(1)}%  draw ${(tally.draw / 20).toFixed(1)}%`);
  }
  const tally = { a: 0, b: 0, both: 0, draw: 0 };
  for (let k = 0; k < 2000; k++) tally[duel(aiPick, uniform)]++;
  const resting = { a: 0, b: 0, both: 0, draw: 0 };
  for (let k = 0; k < 500; k++) resting[duel(aiPick, () => 'blank')]++;
  lines.push(`${monster.name} vs a player who casts nothing: wins ${(resting.a / 5).toFixed(1)}%  draw ${(resting.draw / 5).toFixed(1)}%`);
  const warding = { a: 0, b: 0, both: 0, draw: 0 };
  for (let k = 0; k < 500; k++) warding[duel(aiPick, () => 'ward')]++;
  const turtling = { a: 0, b: 0, both: 0, draw: 0 };
  for (let k = 0; k < 500; k++) turtling[duel(aiPick, () => 'ring-wave')]++;
  lines.push(`${monster.name} vs a player who only rings water: wins ${(turtling.a / 5).toFixed(1)}%  draw ${(turtling.draw / 5).toFixed(1)}%`);
  lines.push(`${monster.name} vs a player who only wards: wins ${(warding.a / 5).toFixed(1)}%  draw ${(warding.draw / 5).toFixed(1)}%`);
  lines.push(`${monster.name} vs uniform player: wins ${(tally.a / 20).toFixed(1)}%  loses ${(tally.b / 20).toFixed(1)}%  both ${(tally.both / 20).toFixed(1)}%  draw ${(tally.draw / 20).toFixed(1)}%`);
  const cast = Object.values(casts).reduce((a, b) => a + b, 0);
  const share = ids => ids.reduce((a, id) => a + (casts[id] || 0), 0) / cast;
  const ownCasts = S.OPTIONS.filter(id => S.byId[id].elements.some(e => (monster.elements || []).includes(e)));
  const ringCasts = S.OPTIONS.filter(id => S.isRing(id) || id === 'ward');
  lines.push(`${monster.name} casts: ${Object.entries(casts).sort((p, q) => q[1] - p[1]).slice(0, 6).map(([id, n]) => `${S.byId[id].name} ${(n / cast * 100).toFixed(0)}%`).join(', ')}; its own element ${(share(ownCasts) * 100).toFixed(0)}%, rings ${(share(ringCasts) * 100).toFixed(0)}%`);
  console.log('INFO balance over 2000 duels each\n  ' + lines.join('\n  '));
  assert.ok(tally.a > tally.b, 'the monster should beat a player who draws at random');
  assert.ok(share(ownCasts) >= .6, 'the Salamander follows the flame');
  assert.ok(share(ringCasts) >= .15 && share(ringCasts) <= .45, 'and protects itself without turtling');
  assert.ok(S.scoreOptions(monster, S.emptyBody(), S.maskBody(S.emptyBody()), []).find(o => o.id === 'flame').score > S.scoreOptions(monster, S.emptyBody(), S.maskBody(S.emptyBody()), []).find(o => o.id === 'stone').score, 'on an empty board it prefers flame to stone');
  assert.equal(resting.draw, 0, 'casting nothing forever must not stall the duel');
  assert.ok(warding.draw / 5 < 5, 'warding forever must not stall the duel');
  assert.ok(turtling.draw / 5 < 25, 'a single hidden ring must not stall the duel for long');
}

async function browser() {
  const toolsPath = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
  const { chromium } = require(toolsPath ? path.join(toolsPath, 'playwright') : 'playwright');
  const base = (process.env.HOUSE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
  const browser = await chromium.launch({ headless: true });
  try {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/glyphs.html');
    await page.waitForFunction(() => window.glyphsDuel);
    // The monster always fumbles until told otherwise, so only the player's
    // glyph lands and the round resolves as soon as the player casts.
    // A rough Flame is already in the grimoire; a closer drawing will replace it.
    await page.evaluate(() => {
      localStorage.setItem('glyphs-grimoire', JSON.stringify({ flame: { strokes: [[[.5, .1], [.9, .9], [.1, .9], [.5, .1]]], distance: 1.1, when: '2026-10-24T00:00:00.000Z' } }));
      window.GlyphsSpells.chooseSpell = () => 'fizzle';
      window.GlyphsSpells.monsterPower = () => 1;
      window.glyphsDuel.startDuel();
    });
    const sheet = page.locator('#sheet');
    const box = await sheet.boundingBox();
    const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    const draw = async pts => {
      await page.mouse.move(...pts[0]); await page.mouse.down();
      for (const p of pts.slice(1)) await page.mouse.move(...p, { steps: 5 });
      await page.mouse.up();
    };
    const triangle = [at(.5, .14), at(.86, .82), at(.14, .82), at(.5, .14)];
    // A slanted, uneven triangle: still Flame, but not a perfect one.
    const roughTriangle = [at(.56, .2), at(.9, .7), at(.62, .86), at(.2, .78), at(.42, .5), at(.56, .2)];
    // Nothing moves before Begin: the battlefield is shown, the sheet takes no
    // ink and the clock stands.
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.phase), 'ready');
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'arena');
    assert.equal(await page.locator('#sheet').isVisible(), false);
    assert.equal(await page.locator('#cast').isDisabled(), true);
    await draw([at(.3, .3), at(.7, .7)]);
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.strokes.length), 0);
    assert.equal(await page.locator('#timer-seconds').textContent(), '10', 'the ready clock shows the real round length');
    // A long clock keeps the slow mouse drawing from timing a round out.
    await page.evaluate(() => { window.GlyphsSpells.ROUND_SECONDS = 90; });
    await page.click('#begin');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
    assert.equal(await page.locator('#begin').isHidden(), true);
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'sheet');
    assert.equal(await page.locator('#sheet').isVisible(), true);
    // A perfect flame on an unguarded monster is a death in one round.
    await draw(triangle);
    assert.equal(await page.locator('#sheet-state').textContent(), 'the ink sets, perfect');
    assert.deepEqual(await page.evaluate(() => { const r = window.glyphsDuel.readSheet(); return [r.id, r.power]; }), ['flame', 3]);
    await page.click('#cast');
    assert.notEqual(await page.evaluate(() => window.glyphsDuel.state.phase), 'drawing', 'cast resolves at once');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'ended');
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'arena', 'casting shows the battlefield');
    const narration = await page.locator('#narration').textContent();
    assert.match(narration, /You cast Flame, perfectly/);
    assert.match(narration, /finds no answer and goes on/);
    assert.equal(await page.locator('#caster-foe [data-hits] li').first().textContent(), 'flame strikes, no ring');
    assert.equal(await page.locator('#caster-you [data-hits] li').first().textContent(), 'untouched');
    assert.equal(await page.locator('.stage-token[data-token="you"] circle').count(), 2, 'two precision rings');
    assert.equal(await page.locator('#duel-end-title').textContent(), 'The duel is yours');
    assert.equal(await page.locator('#duel-end').evaluate(e => getComputedStyle(e).position), 'static', 'the end card sits in the page');
    assert.equal(await page.locator('#narration').isVisible(), true, 'the round can still be read');
    assert.match(await page.locator('#duel-end-line').textContent(), /burnt to ash/);
    assert.equal(await page.locator('#caster-foe').getAttribute('data-death'), 'fire');
    assert.equal(await page.locator('#grimoire-list li strong').first().textContent(), 'Flame');
    const written = await page.evaluate(() => JSON.parse(localStorage.getItem('glyphs-grimoire')).flame);
    assert.ok(written.distance < .5, `the perfect drawing replaced the rough one (distance ${written.distance})`);
    assert.equal(await page.locator('#grimoire-list li').first().getAttribute('data-hand'), '3');
    assert.match(await page.locator('#grimoire-list li small').first().textContent(), /drawn perfect/);
    assert.equal(await page.locator('.stage.is-animating').count(), 0, 'reduced motion skips the stage animation');
    // Duel again: a blank sheet casts nothing.
    await page.click('#again');
    await page.waitForFunction(() => window.glyphsDuel.state.round === 1 && window.glyphsDuel.state.phase === 'drawing');
    assert.equal(await page.locator('#caster-foe [data-state]').textContent(), 'no ring');
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
    assert.match(await page.locator('#narration').textContent(), /You cast nothing/);
    assert.equal(await page.locator('#caster-you [data-hits] li').first().textContent(), 'nothing');
    // Nothing moves on until the player asks for the next sheet.
    assert.equal(await page.locator('#next').isVisible(), true);
    assert.equal(await page.locator('.duel').getAttribute('data-scene'), 'arena');
    await page.click('#next');
    // A scribble fizzles, and the glow never names a spell.
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing' && window.glyphsDuel.state.round === 2);
    await draw([at(.2, .3), at(.3, .7), at(.4, .3), at(.5, .7), at(.7, .4), at(.8, .6)]);
    assert.equal(await page.evaluate(() => window.glyphsDuel.readSheet().id), 'fizzle');
    assert.ok(!/flame|wave|stone|wind|ward|mirror|bolt|frost|vine|magma/i.test(await page.locator('#sheet-state').textContent()));
    await page.click('#clear');
    assert.equal(await page.evaluate(() => window.glyphsDuel.readSheet().id), 'blank');
    // A triangle inside a circle is a ring of fire; the player sees its element.
    const bigRing = Array.from({ length: 41 }, (_, i) => at(.5 + .44 * Math.cos(i / 40 * Math.PI * 2), .5 + .44 * Math.sin(i / 40 * Math.PI * 2)));
    await draw(bigRing);
    await draw([at(.5, .3), at(.68, .64), at(.32, .64), at(.5, .3)]);
    assert.match(await page.locator('#sheet-state').textContent(), /in a ring$/);
    assert.deepEqual(await page.evaluate(() => { const r = window.glyphsDuel.readSheet(); return [r.id, r.ring]; }), ['ring-flame', true]);
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
    assert.match(await page.locator('#narration').textContent(), /You cast Ring of Flame/);
    assert.match(await page.locator('#caster-you [data-state]').textContent(), /^ring of flame, [23]$/);
    assert.match(await page.locator('#caster-you [data-hits] li').first().textContent(), /^ring of flame, [23] raised$/);
    assert.ok(await page.locator('#caster-you [data-barrier] circle').count() >= 2, 'ring arcs round the portrait');
    assert.equal(await page.locator('#grimoire-list li').count(), 1, 'the glyph inside the ring is written once, as Flame');
    assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('glyphs-grimoire')).flame.distance)) < .5, 'a rougher drawing does not replace a closer one');
    // The monster's ring is seen as a bare ring; a strike then reveals it.
    await page.evaluate(() => { window.GlyphsSpells.chooseSpell = () => 'ring-wave'; window.GlyphsSpells.monsterPower = () => 3; });
    await page.click('#next');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing' && window.glyphsDuel.state.round === 3);
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
    assert.equal(await page.locator('#caster-foe [data-state]').textContent(), 'a ring, 3');
    assert.equal(await page.locator('#caster-foe [data-hits] li').first().textContent(), 'a ring, 3 raised');
    assert.match(await page.locator('#narration').textContent(), /The Salamander cast a ring, perfectly/);
    assert.ok(!/water|wave/i.test(await page.locator('#narration').textContent()), 'the ring\'s element is not named');
    assert.equal(await page.locator('#caster-foe [data-barrier] circle[stroke-dasharray="14 7"]').count(), 3, 'a bare ring is drawn for the foe');
    await page.evaluate(() => { window.GlyphsSpells.chooseSpell = () => 'fizzle'; });
    await page.click('#next');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing' && window.glyphsDuel.state.round === 4);
    await draw(triangle);
    await page.click('#cast');
    await page.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
    assert.equal(await page.locator('#caster-foe [data-hits] li').first().textContent(), 'turned aside');
    assert.match(await page.locator('#narration').textContent(), /the ring turns flame aside \(water and flame quench each other\)/, 'the outcome line says why');
    assert.equal(await page.locator('#caster-foe [data-state]').textContent(), 'a ring, 3', 'a ring that turns a strike aside is untouched');
    assert.ok((await page.locator('#elements-rules li').count()) >= 5, 'the elements panel explains the wheel in play');
    assert.match(await page.locator('#elements-rules').textContent(), /never perfect/, 'and says what a compound costs');
    // The grimoire survives a reload; the house nav returns to the landing.
    await page.reload();
    await page.waitForFunction(() => window.glyphsDuel);
    assert.equal(await page.evaluate(() => window.glyphsDuel.state.phase), 'ready');
    assert.equal(await page.locator('#grimoire-list li strong').first().textContent(), 'Flame');
    await page.locator('.house-room-nav').waitFor();
    assert.equal(await page.locator('.house-return').getAttribute('href'), '/#first-floor');
    assert.equal(await page.locator('#house-return-fallback').count(), 0);
    console.log('PASS duel: waits for Begin on the battlefield, scenes switch on cast, cast resolves at once with badges and outcome lines, a perfect flame kills in one round, blank casts nothing, fizzle without a name, a glyph in a circle is a ring the player sees and the foe does not, a strike reveals a ring, the grimoire keeps the closest drawing, house return');

    // The round clock runs out on its own.
    const clock = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
    clock.on('pageerror', error => errors.push(error.message));
    await clock.goto(base + '/glyphs.html');
    await clock.waitForFunction(() => window.glyphsDuel);
    await clock.evaluate(() => { window.GlyphsSpells.chooseSpell = () => 'fizzle'; window.glyphsDuel.startDuel(); window.glyphsDuel.beginDuel(); });
    await clock.waitForFunction(() => window.glyphsDuel.state.phase === 'between', null, { timeout: 15000 });
    assert.equal(await clock.locator('#next').isVisible(), true);
    await clock.close();
    console.log('PASS the clock resolves a round after ten seconds and then waits for the player');

    // The grimoire page is complete and the pad reads a drawing.
    const grimoire = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    grimoire.on('pageerror', error => errors.push(error.message));
    await grimoire.goto(base + '/glyphs-grimoire.html');
    await grimoire.locator('#spell-list li').first().waitFor();
    assert.equal(await grimoire.locator('#spell-list li').count(), S.spells.length + 3, 'spells, the ring card, blank and fizzle');
    const matrixOptions = S.OPTIONS.filter(id => !S.isRing(id));
    assert.equal(await grimoire.locator('#matrix thead th').count(), matrixOptions.length + 2);
    assert.equal(await grimoire.locator('#spell-list li').filter({ hasText: 'Bolt' }).count(), 1);
    assert.equal(await grimoire.locator('#matrix tbody tr').count(), matrixOptions.length + 1);
    assert.equal(await grimoire.locator('#deaths tbody tr').count(), 4);
    assert.equal(await grimoire.locator('#monster-list li').count(), S.monsters.length);
    assert.equal(await grimoire.locator('#wheel .wheel-node').count(), S.ELEMENTS.length);
    assert.equal(await grimoire.locator('#wheel .wheel-beats').count(), S.relations.filter(r => r.kind === 'beats').length);
    assert.equal(await grimoire.locator('#matrix td.derived').count(), 0, 'every pair is written by hand as the data stands');
    await grimoire.locator('#pad').scrollIntoViewIfNeeded();
    const pad = await grimoire.locator('#pad').boundingBox();
    const circle = Array.from({ length: 41 }, (_, i) => [pad.x + pad.width * (.5 + .34 * Math.cos(i / 40 * Math.PI * 2)), pad.y + pad.height * (.5 + .34 * Math.sin(i / 40 * Math.PI * 2))]);
    await grimoire.mouse.move(...circle[0]); await grimoire.mouse.down();
    for (const p of circle.slice(1)) await grimoire.mouse.move(...p, { steps: 2 });
    await grimoire.mouse.up();
    assert.match(await grimoire.locator('#pad-reading').textContent(), /Reads as Ward/);
    assert.equal(await grimoire.locator('.house-room-nav').count(), 0, 'the grimoire is not a room');
    await grimoire.close();
    console.log('PASS grimoire page: spells, matrix, deaths, monsters, test pad');

    // The forge: the wheel turns a relation and the matrix follows, an element
    // can be added, a drawing becomes a shape, and a save without the token
    // writes nothing.
    const forge = await browser.newPage({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
    forge.on('pageerror', error => errors.push(error.message));
    forge.on('dialog', dialog => dialog.dismiss());
    await forge.goto(base + '/glyphs-editor.html');
    await forge.waitForFunction(() => window.glyphsForge);
    assert.equal(await forge.locator('#wheel .wheel-node').count(), S.ELEMENTS.length);
    assert.equal(await forge.locator('#elements tbody tr').count(), S.ELEMENTS.length);
    assert.equal(await forge.locator('#spells .spell-form').count(), S.spells.length);
    assert.equal(await forge.locator('#reactions tbody tr').count(), S.SIMPLE.length * (S.SIMPLE.length + 1) / 2);
    assert.match(await forge.locator('#status').textContent(), /Everything here is saved/);
    await forge.click('#wheel .wheel-node[data-id="fire"]');
    await forge.click('#wheel .wheel-node[data-id="earth"]');
    assert.equal(await forge.locator('#wheel .wheel-beats[data-pair="earth fire"]').count(), 1, 'two clicks turn the arrow round');
    assert.match(await forge.locator('#status').textContent(), /Unsaved/);
    await forge.click('[data-reaction-row="flame stone"] [data-action="reset-reaction"]');
    assert.equal(await forge.locator('[data-reaction-row="flame stone"] input.name').inputValue(), 'overcome');
    assert.equal(await forge.locator('[data-reaction-row="flame stone"] input.marks').first().inputValue(), 'earth', 'stone now beats flame, so the flame caster takes earth');
    await forge.click('[data-action="add-element"]');
    assert.equal(await forge.locator('#wheel .wheel-node').count(), S.ELEMENTS.length + 1);
    assert.match(await forge.locator('#status').textContent(), /Not valid/);
    await forge.fill('#elements tbody tr:last-child input[aria-label="name"]', 'iron');
    await forge.fill('#elements tbody tr:last-child input[aria-label="death"]', 'cut down');
    await forge.fill('#elements tbody tr:last-child input[aria-label="what is said"]', 'The iron finds them.');
    assert.match(await forge.locator('#status').textContent(), /^Valid/);
    assert.equal(await forge.locator('#spells .spell-form').first().locator('.checks label').count(), S.ELEMENTS.length + 1, 'the new element is offered to every spell');
    await forge.locator('#pad').scrollIntoViewIfNeeded();
    const forgePad = await forge.locator('#pad').boundingBox();
    await forge.selectOption('#pad-spell', 'wind');
    await forge.mouse.move(forgePad.x + forgePad.width * .2, forgePad.y + forgePad.height * .8); await forge.mouse.down();
    await forge.mouse.move(forgePad.x + forgePad.width * .8, forgePad.y + forgePad.height * .2, { steps: 12 }); await forge.mouse.up();
    await forge.click('#pad-keep-variant');
    assert.equal(await forge.evaluate(() => window.glyphsForge.data.spells.find(s => s.id === 'wind').shapes.length), S.byId.wind.variants.length + 1, 'the drawing is kept as a variant');
    assert.equal(await forge.evaluate(() => window.glyphsForge.data.spells.find(s => s.id === 'wind').shapes.pop().kind), 'strokes');
    const dataFile = path.join(__dirname, '..', 'public', 'glyphs-data.js');
    const before = require('node:fs').readFileSync(dataFile, 'utf8');
    await forge.evaluate(() => localStorage.setItem('glyphs-edit-token', 'not-the-token'));
    await forge.click('#save');
    await forge.waitForFunction(() => /Wrong token|Saving is off|Could not/.test(document.getElementById('status').textContent));
    assert.equal(require('node:fs').readFileSync(dataFile, 'utf8'), before, 'nothing is written without the token');
    await forge.evaluate(() => localStorage.removeItem('glyphs-edit-token'));
    await forge.close();
    console.log('PASS forge: wheel turns a relation, matrix follows the wheel, element added, drawing kept as a shape, save refused without the token');

    // Two phones: a server of this tree is started on its own port so the duel
    // module under test is the one in the working copy.
    const ONLINE_PORT = 8097;
    const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(ONLINE_PORT) }, stdio: 'ignore' });
    try {
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const probe = () => http.get(`http://127.0.0.1:${ONLINE_PORT}/glyphs.html`, res => { let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => /glyphs-server|Glyphs/.test(body) ? resolve() : reject(new Error('another server answers on the test port'))); }).on('error', () => Date.now() - started > 8000 ? reject(new Error('test server did not start')) : setTimeout(probe, 150));
        probe();
      });
      const onlineBase = `http://127.0.0.1:${ONLINE_PORT}`;
      const host = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const guest = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      for (const p of [host, guest]) p.on('pageerror', error => errors.push(error.message));
      await host.goto(onlineBase + '/glyphs.html');
      await host.waitForFunction(() => window.glyphsDuel);
      await host.click('#friend');
      await host.locator('#online-host:not([hidden])').waitFor();
      const code = await host.locator('#online-code').textContent();
      assert.match(code, /^[A-Z]{4}$/);
      assert.equal(await host.locator('#online-link').getAttribute('href'), `${onlineBase}/glyphs.html#duel=${code}`);
      await guest.goto(`${onlineBase}/glyphs.html#duel=${code}`);
      await guest.waitForFunction(() => window.glyphsDuel && window.glyphsDuel.state.phase === 'drawing');
      await host.waitForFunction(() => window.glyphsDuel.state.phase === 'drawing');
      assert.equal(await host.locator('#foe-name').textContent(), 'The other caster');
      assert.equal(await host.locator('.duel').getAttribute('data-scene'), 'sheet');
      // The host draws a rough flame and casts; the guest leaves the sheet
      // blank. Each side sees the round from its own chair.
      const hb = await host.locator('#sheet').boundingBox();
      const hat = (fx, fy) => [hb.x + hb.width * fx, hb.y + hb.height * fy];
      const roughFlame = [hat(.56, .2), hat(.9, .7), hat(.62, .86), hat(.2, .78), hat(.42, .5), hat(.56, .2)];
      await host.mouse.move(...roughFlame[0]); await host.mouse.down();
      for (const p of roughFlame.slice(1)) await host.mouse.move(...p, { steps: 5 });
      await host.mouse.up();
      assert.equal(await host.evaluate(() => window.glyphsDuel.readSheet().id), 'flame');
      await host.click('#cast');
      assert.match(await host.locator('#sheet-state').textContent(), /waiting for the other caster/);
      await guest.waitForFunction(() => document.getElementById('quill').dataset.quill === 'sealed');
      await guest.click('#cast');
      await host.waitForFunction(() => window.glyphsDuel.state.phase === 'ended');
      await guest.waitForFunction(() => window.glyphsDuel.state.phase === 'ended');
      assert.match(await host.locator('#narration').textContent(), /You cast Flame/);
      assert.match(await guest.locator('#narration').textContent(), /You cast nothing/);
      assert.match(await guest.locator('#caster-you [data-hits] li').first().textContent(), /flame strikes, no ring/);
      assert.equal(await guest.evaluate(() => window.glyphsDuel.state.phase), 'ended', 'an unguarded guest falls to the first flame');
      assert.equal(await guest.locator('#grimoire-list li').count(), 0, 'a blank sheet writes nothing');
      assert.equal(await host.locator('#grimoire-list li strong').first().textContent(), 'Flame');
      // Both agree to duel again: the server starts a fresh table, with the
      // guest's ring masked on the host's side once raised.
      await host.click('#again');
      await guest.waitForFunction(() => !document.getElementById('duel-end-note').hidden);
      await guest.click('#again');
      await host.waitForFunction(() => window.glyphsDuel.state.round === 1 && window.glyphsDuel.state.phase === 'drawing', null, { timeout: 15000 });
      await guest.waitForFunction(() => window.glyphsDuel.state.round === 1 && window.glyphsDuel.state.phase === 'drawing');
      const gb = await guest.locator('#sheet').boundingBox();
      const gat = (fx, fy) => [gb.x + gb.width * fx, gb.y + gb.height * fy];
      const guestRing = Array.from({ length: 41 }, (_, i) => gat(.5 + .44 * Math.cos(i / 40 * Math.PI * 2), .5 + .44 * Math.sin(i / 40 * Math.PI * 2)));
      await guest.mouse.move(...guestRing[0]); await guest.mouse.down();
      for (const p of guestRing.slice(1)) await guest.mouse.move(...p, { steps: 2 });
      await guest.mouse.up();
      const guestWave = [gat(.25, .5), gat(.33, .38), gat(.42, .5), gat(.5, .62), gat(.58, .5), gat(.67, .38), gat(.75, .5)];
      await guest.mouse.move(...guestWave[0]); await guest.mouse.down();
      for (const p of guestWave.slice(1)) await guest.mouse.move(...p, { steps: 4 });
      await guest.mouse.up();
      assert.equal(await guest.evaluate(() => window.glyphsDuel.readSheet().id), 'ring-wave');
      await guest.click('#cast');
      await host.click('#cast');
      await host.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
      await guest.waitForFunction(() => window.glyphsDuel.state.phase === 'between');
      assert.match(await guest.locator('#caster-you [data-state]').textContent(), /^ring of water, [123]$/);
      assert.match(await host.locator('#caster-foe [data-state]').textContent(), /^a ring, [123]$/, 'the host sees a bare ring');
      assert.ok(!/water|wave/i.test(await host.locator('#narration').textContent()), 'the server never names the other ring');
      assert.equal(await host.evaluate(() => JSON.stringify(window.glyphsDuel.state.foe.ring.elements)), '["hidden"]');
      await host.waitForFunction(() => /next sheet comes in \d+ s/.test(document.getElementById('next-note').textContent));
      assert.equal(await host.locator('#next').isVisible(), false, 'between phones the server sets the pace');
      await host.waitForFunction(() => window.glyphsDuel.state.round === 2 && window.glyphsDuel.state.phase === 'drawing', null, { timeout: 25000 });
      // A guest who leaves ends the duel at the host's table.
      await guest.close();
      await host.waitForFunction(() => window.glyphsDuel.net.mode === 'monster' && window.glyphsDuel.state.phase === 'ready');
      assert.match(await host.locator('#narration').textContent(), /left the table/);
      assert.equal(await host.locator('#foe-name').textContent(), 'The Salamander');
      // A wrong code is refused politely.
      await host.click('#friend');
      await host.locator('#online-host:not([hidden])').waitFor();
      await host.fill('#online-input', 'ZZZZ');
      await host.click('#online-join button');
      await host.waitForFunction(() => /No duel is waiting/.test(document.getElementById('online-status').textContent));
      await host.close();
      console.log('PASS two phones: table code and link, both sheets sealed by the server, each side sees its own perspective, duel again on both sides, the other ring is masked by the server, leaving ends the duel, wrong code refused');
    } finally {
      server.kill();
    }

    // A phone fits without sideways scrolling.
    const phone = await browser.newPage({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(base + '/glyphs.html');
    await phone.waitForFunction(() => window.glyphsDuel);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await phone.locator('#elements-wheel .wheel-node').count(), S.ELEMENTS.length, 'the duel shows the element wheel');
    await phone.goto(base + '/glyphs-grimoire.html');
    await phone.locator('#spell-list li').first().waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await phone.goto(base + '/glyphs-editor.html');
    await phone.waitForFunction(() => window.glyphsForge);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await phone.close();
    assert.deepEqual(errors, []);
    console.log('PASS phone viewport without horizontal overflow, and no JavaScript errors');
  } finally {
    await browser.close();
  }
}

(async () => {
  unit();
  if (!process.argv.includes('--unit')) await browser();
})().catch(error => { console.error(error); process.exit(1); });
