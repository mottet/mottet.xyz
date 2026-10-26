'use strict';

// The designer's grimoire renders the rules file so the page never drifts
// from what the game does.
(() => {
  const S = window.GlyphsSpells, R = window.GlyphsRecognizer;
  if (!S || !R) return;
  const el = id => document.getElementById(id);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pathOf = (strokes, size = 100, inset = 8) => strokes.map(s => 'M' + s.map(p => p.map(v => (inset + v * (size - 2 * inset)).toFixed(1)).join(' ')).join('L')).join('');

  el('round-rules').innerHTML = [
    `Each round lasts <strong>${S.ROUND_SECONDS} seconds</strong>. Both casters draw at once, on their own sheet, unseen by the other.`,
    'A caster may <strong>cast</strong> at any moment; the monster answers at once and the round resolves on the spot. Otherwise it resolves when the clock runs out.',
    'The sheet is read once: a drawing near enough to a glyph becomes that spell; one that is no glyph <strong>fizzles</strong> (nothing happens, no rest); a blank sheet is a <strong>rest</strong>.',
    'The two spells meet in the arena. One named reaction plays, marks land on bodies, opposite marks cancel, and deaths are checked. Both casters can die in the same round.',
    'The game shows the ink glowing as the drawing nears any glyph, without naming it. Only the reaction reveals what was cast.',
    `<strong>Compound spells</strong> (Bolt, Frost, Vine, Magma) join two elements. They react as each of their parts would against the other spell, one after the other, and the marks add up; unanswered, they land one mark of each element. Against a guard both parts are judged separately, so a Bolt against a mirror comes back as fire and wind, and against the ring both parts leap it.`,
    `<strong>Momentum.</strong> The same attack cast in consecutive rounds grows by one mark a round, up to ${S.MAX_POWER}. A mark is as strong as the spell of its element, and when both cast that element each takes the other's; so a reflected or fanned flame returns with its caster's own momentum. Rest, a fizzle, a guard or another glyph breaks the run. This is what stops a caster from resting forever: a second Flame lands two marks, a third lands three.`,
    'The duel does not start on its own. The table is set and the player presses Begin; Duel again starts the next one at once.',
    '<strong>Two phones.</strong> Duel a friend sets a table on the server under a four-letter code; the other caster enters the code or opens the link. The server keeps the clock and runs the rules, both sheets are sealed server-side, and the reaction is sent to both at once, each from their own side. A sheet not cast when the clock runs out is read as it stands; a caster who leaves ends the duel. Duel again needs both to agree.',
    'The table shows one scene at a time. Drawing happens on the sheet; casting sends the sheet away and brings up the battlefield, where the two tokens meet and the reaction blooms; the next round drops a fresh sheet in. Reduced motion swaps the scenes without the animation.'
  ].map(t => `<li>${t}</li>`).join('');

  const spellCard = spell => {
    const variants = (spell.variants || []).slice(1).map(v => `<path class="variant" d="${pathOf(v)}"/>`).join('');
    return `<li><svg viewBox="0 0 100 100" aria-label="${spell.name}: ${spell.glyph}">${variants}<path d="${pathOf(spell.strokes)}"/></svg><div><strong>${spell.name}</strong><small>${spell.elements.length ? `${spell.elements.join(' and ')}, ${spell.kind}` : spell.kind} · ${spell.glyph}</small><p>${spell.flavour}</p></div></li>`;
  };
  const idle = spell => `<li><svg viewBox="0 0 100 100" aria-label="${spell.name}: ${spell.glyph}">${spell.id === 'fizzle' ? '<path d="M30 70C24 50 48 48 40 30M56 72C50 54 70 50 62 30" class="variant" style="stroke-width:3;opacity:.8"/>' : ''}</svg><div><strong>${spell.name}</strong><small>${spell.kind} · ${spell.glyph}</small><p>${spell.flavour}</p></div></li>`;
  el('spell-list').innerHTML = S.spells.map(spellCard).join('') + idle(S.REST) + idle(S.FIZZLE);

  const columns = S.OPTIONS.concat('fizzle');
  const marksText = (marks, who) => S.ELEMENTS.filter(e => marks[e]).map(e => `<span class="${who}">${who === 'me' ? '' : 'them '}+${marks[e]} ${e}</span>`).join(', ');
  const cell = (a, b) => {
    const r = S.reactions(a, b);
    const me = marksText(r.marks.a, 'me'), them = marksText(r.marks.b, 'them');
    const heal = (a === 'rest' ? '<span class="them">I heal first</span>' : '') + (b === 'rest' ? (a === 'rest' ? ', ' : '') + '<span class="me">they heal first</span>' : '');
    const body = [me, them, heal].filter(Boolean).join(', ') || '<span class="none">nothing lands</span>';
    return `<td><strong>${r.name}</strong>${body}</td>`;
  };
  el('matrix').innerHTML = `<thead><tr><th scope="col">me \\ them</th>${columns.map(id => `<th scope="col">${S.byId[id].name}</th>`).join('')}</tr></thead><tbody>${columns.map(a => `<tr><th scope="row">${S.byId[a].name}</th>${columns.map(b => cell(a, b)).join('')}</tr>`).join('')}</tbody>`;

  el('body-rules').innerHTML = [
    `A body holds marks in four elements: ${S.ELEMENTS.map(e => `<strong>${e}</strong> (${S.MARK_NAMES[e]}s)`).join(', ')}.`,
    `At the end of every round opposite marks cancel one for one: fire and water become <strong>steam</strong>, earth and air become <strong>dust</strong>. A body never holds both halves of a pair.`,
    `<strong>${S.DEATH_AT} marks</strong> of one element kill. Rest removes one mark of the rester's heaviest element before the reaction lands.`
  ].map(t => `<li>${t}</li>`).join('');
  el('deaths').innerHTML = `<thead><tr><th>Element</th><th>Death</th><th>What is said</th></tr></thead><tbody>${S.ELEMENTS.map(e => `<tr><td>${cap(e)}</td><td>${S.DEATHS[e].name}</td><td>${S.DEATHS[e].line}</td></tr>`).join('')}</tbody>`;

  el('monster-list').innerHTML = S.monsters.map(m => `<li><strong>${cap(m.name)}</strong>: ${m.line} It knows both casters' momentum and weighs each option at the strength it would have. Leans towards ${Object.entries(m.bias).map(([id, b]) => `${S.byId[id].name} (+${b})`).join(', ')}; draws a working glyph ${Math.round(m.accuracy * 100)}% of the time. Each round it scores every option by the expected change in squared marks on both bodies (its own weighted 1.3×, a kill +10, its own death −14) against a belief over the player's next spell (a uniform prior of two counts per option, plus the player's history), adds its bias, and samples with softmax at temperature ${m.temperature}.</li>`).join('');

  el('recogniser-rules').innerHTML = [
    `<strong>$P point-cloud recogniser</strong> (Vatavu, Anthony and Wobbrock, 2012): ${R.N} resampled points, scaled to a unit box keeping aspect, centred, matched greedily. Strokes may be drawn in any number, order or direction. Rotation matters.`,
    `Two cues from the raw strokes sharpen the match: whether the figure <strong>closes</strong> (start and end within 22% of its size, +0.6 distance on a mismatch) and how many <strong>corners</strong> it has (sharp turns between straight legs, +0.35 per corner of difference).`,
    `A drawing is accepted when its best candidate is within distance <strong>${R.ACCEPT}</strong>; further than that it fizzles. Drawings smaller than 12% of the sheet are smudges and fizzle too.`,
    `Templates are generated from geometry in the rules file. Faint lines in the cards above are the extra variants (a three-crest wave, spirals of either hand).`
  ].map(t => `<li>${t}</li>`).join('');

  // The test pad.
  const pad = el('pad'), ctx = pad.getContext('2d'), frame = el('pad-frame'), reading = el('pad-reading'), list = el('pad-candidates');
  const templates = S.spells.flatMap(spell => spell.variants.map(strokes => ({ id: spell.id, strokes })));
  const prepared = R.prepare(templates);
  let strokes = [], drawing = false;
  const point = event => { const b = pad.getBoundingClientRect(); return [(event.clientX - b.left) * pad.width / b.width, (event.clientY - b.top) * pad.height / b.height]; };
  const paint = () => {
    ctx.clearRect(0, 0, pad.width, pad.height);
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f3329';
    for (const s of strokes) { if (s.length < 2) continue; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); s.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); }
  };
  const read = () => {
    const live = strokes.filter(s => s.length > 1);
    if (!live.length) { reading.textContent = 'Draw on the sheet to see the ranked candidates.'; list.innerHTML = ''; frame.classList.remove('is-set'); return; }
    const cues = R.cues(live), candidates = R.recognize(live, prepared), best = candidates[0];
    const accepted = best.distance <= R.ACCEPT;
    reading.innerHTML = `${accepted ? `Reads as <strong>${S.byId[best.id].name}</strong>` : 'Fizzles'} · ${cues.closed ? 'closed' : 'open'}, ${cues.corners} corner${cues.corners === 1 ? '' : 's'}, extent ${Math.round(R.extent(live) / pad.width * 100)}%`;
    list.innerHTML = candidates.map(c => `<li class="${c.distance <= R.ACCEPT ? 'accepted' : ''}">${S.byId[c.id].name}: ${c.distance.toFixed(2)}</li>`).join('');
    frame.classList.toggle('is-set', accepted);
  };
  pad.addEventListener('pointerdown', e => { e.preventDefault(); pad.setPointerCapture(e.pointerId); drawing = true; strokes.push([point(e)]); });
  pad.addEventListener('pointermove', e => { if (!drawing) return; strokes[strokes.length - 1].push(point(e)); paint(); });
  const up = e => { if (!drawing) return; drawing = false; try { pad.releasePointerCapture(e.pointerId); } catch { /* fine */ } paint(); read(); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  el('pad-clear').addEventListener('click', () => { strokes = []; paint(); read(); });
})();
