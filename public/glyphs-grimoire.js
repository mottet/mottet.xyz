'use strict';

// The designer's grimoire renders the rules file so the page never drifts
// from what the game does.
(() => {
  const S = window.GlyphsSpells, R = window.GlyphsRecognizer, W = window.GlyphsWheel;
  if (!S || !R || !W) return;
  const el = id => document.getElementById(id);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pathOf = (strokes, size = 100, inset = 8) => strokes.map(s => 'M' + s.map(p => p.map(v => (inset + v * (size - 2 * inset)).toFixed(1)).join(' ')).join('L')).join('');

  el('round-rules').innerHTML = [
    `Each round lasts <strong>${S.ROUND_SECONDS} seconds</strong>. Both casters draw at once, on their own sheet, unseen by the other.`,
    'A caster may <strong>cast</strong> at any moment; the monster answers at once and the round resolves on the spot. Otherwise it resolves when the clock runs out, with the sheet read as it stands.',
    'The sheet is read once: a drawing near enough to a glyph becomes that spell; one that is no glyph <strong>fizzles</strong>; a blank sheet casts <strong>nothing</strong>.',
    `<strong>Precision is power.</strong> A spell is as strong as the hand that drew it: within ${S.POWER_LEVELS[0].within} of the glyph it has power 3, within ${S.POWER_LEVELS[1].within} power 2, otherwise 1. The sheet says "the ink sets", "clean" or "perfect" as the glyph is read.`,
    `<strong>No life points.</strong> A caster stands behind one ring at most. A spell that reaches a caster with no ring kills by its element; a ring turns it aside, is pierced by it, or wears under it. See Rings below.`,
    `<strong>Rings.</strong> A bare circle is a Ward: a ring of no element, strength equal to its power, that thickens whatever ring already stands. An attack glyph drawn <em>inside</em> a circle is a ring of that element, strength equal to the power of the inner glyph; the same element again thickens it, another element replaces it. Never beyond ${S.MAX_RING}.`,
    '<strong>The other caster sees the ring, not what it is made of.</strong> Their portrait shows a bare ring of the right thickness. Only a strike tells: the badge says whether the ring turned the blow aside, was pierced, broke or wore, and the outcome line names the pair of elements that decided it.',
    `<strong>Compound spells</strong> (${S.spells.filter(s => s.elements.length > 1).map(s => s.name).join(', ') || 'none yet'}) join two elements and meet everything with whichever of them fares better, so a round still has one reaction and one line. Against another attack: a side that beats the other somewhere and is beaten nowhere overcomes, and only its spell goes on; if each has the better of the other somewhere they trade and both go on; otherwise what is not quenched goes on. Against a mirror the compound is turned back only if every element is. The price, so that a compound ends up weaker than a natural element: against a ring it is as weak as its weaker element (the ring answers with the better of its answers, so it turns the spell aside if it turns either element aside, and the spell goes straight through only where both would); and it is cast ${S.COMPOUND_COST} power below the hand that drew it (never below 1), as an attack and as a ring, so a perfect compound strikes at ${Math.max(1, S.MAX_POWER - S.COMPOUND_COST)} and cannot break a full ring by force. round.compoundCost in the data. In the balance sim the compounds win fewer duels than any natural element.`,
    'The game shows the ink glowing as the drawing nears any glyph, without naming it. Only the reaction reveals what was cast. A glyph that works is written into the player\'s grimoire in their own hand, and rewritten whenever a closer drawing of it is cast.',
    'The duel does not start on its own. The table is set and the player presses Begin; Duel again starts the next one at once.',
    '<strong>Two phones.</strong> Duel a friend sets a table on the server under a four-letter code; the other caster enters the code or opens the link. The server keeps the clock and runs the rules, both sheets are sealed server-side, and the reaction is sent to both at once, each from their own side, with the other ring masked. A sheet not cast when the clock runs out is read as it stands; a caster who leaves ends the duel. Duel again needs both to agree.',
    'The table shows one scene at a time. Drawing happens on the sheet; casting sends the sheet away and brings up the battlefield, where the two tokens cross, the reaction blooms, and the rings answer one badge at a time. Against the monster the next sheet waits for the player to ask for it; between phones the server allows fourteen seconds and the page counts them down. The end of a duel is a card inside the battlefield, so the last round can still be read and the page still navigated. Reduced motion swaps the scenes without the animation.'
  ].map(t => `<li>${t}</li>`).join('');

  el('wheel').innerHTML = W.svg(S, { id: 'wheel' });
  el('wheel-legend').innerHTML = W.legend(S);

  const spellCard = spell => {
    const variants = (spell.variants || []).slice(1).map(v => `<path class="variant" d="${pathOf(v)}"/>`).join('');
    return `<li><svg viewBox="0 0 100 100" aria-label="${spell.name}: ${spell.glyph}">${variants}<path d="${pathOf(spell.strokes)}"/></svg><div><strong>${spell.name}</strong><small>${spell.elements.length ? `${spell.elements.join(' and ')}, ${spell.kind}` : spell.kind} · ${spell.glyph}</small><p>${spell.flavour}</p></div></li>`;
  };
  const idle = spell => `<li><svg viewBox="0 0 100 100" aria-label="${spell.name}: ${spell.glyph}">${spell.id === 'fizzle' ? '<path d="M30 70C24 50 48 48 40 30M56 72C50 54 70 50 62 30" class="variant" style="stroke-width:3;opacity:.8"/>' : ''}</svg><div><strong>${spell.name}</strong><small>${spell.kind} · ${spell.glyph}</small><p>${spell.flavour}</p></div></li>`;
  const ringCard = () => { const r = S.rings[0]; return `<li><svg viewBox="0 0 100 100" aria-label="A ring: an attack glyph inside a circle">${r.strokes.map((st, i) => `<path d="${pathOf([st], 100, i ? 26 : 6)}"${i ? '' : ' class="variant" style="stroke-width:3;opacity:.9"'}/>`).join('')}</svg><div><strong>Rings</strong><small>barrier · any attack glyph inside a circle</small><p>The glyph held in a ring on the floor. It stands between rounds and the other caster sees only a ring. Flame in a circle is a ring of fire, and so on; a compound in a circle holds both its elements.</p></div></li>`; };
  el('spell-list').innerHTML = S.spells.map(spellCard).join('') + ringCard() + idle(S.BLANK) + idle(S.FIZZLE);

  const columns = S.OPTIONS.filter(id => !S.isRing(id)).concat('fizzle');
  const strikesText = (strikes, who) => strikes.map(st => `<span class="${who}">${who === 'me' ? 'I take' : 'they take'} ${st.elements.join('+')}${st.source === 'own' ? ' (own)' : ''}</span>`).join(', ');
  const cell = (a, b) => {
    const r = S.reactions(a, b);
    const me = strikesText(r.strikes.a, 'me'), them = strikesText(r.strikes.b, 'them');
    const body = [me, them].filter(Boolean).join(', ') || '<span class="none">nothing goes on</span>';
    const derived = S.SIMPLE.includes(a) && S.SIMPLE.includes(b) && S.reactionFor(a, b).derived;
    return `<td${derived ? ' class="derived"' : ''}><strong>${r.name}</strong>${body}</td>`;
  };
  el('matrix').innerHTML = `<thead><tr><th scope="col">me \\ them</th>${columns.map(id => `<th scope="col">${S.byId[id].name}</th>`).join('')}</tr></thead><tbody>${columns.map(a => `<tr><th scope="row">${S.byId[a].name}</th>${columns.map(b => cell(a, b)).join('')}</tr>`).join('')}</tbody>`;

  el('body-rules').innerHTML = [
    `A ring has elements (none for a bare Ward, one for an element in a circle, two for a compound in a circle) and a strength from 1 to ${S.MAX_RING}, the power of the glyph that raised it.`,
    'A strike meets the ring on the wheel and one of three things happens. <strong>Turned aside</strong>: the ring\'s element beats or quenches the striking element; the ring is untouched. <strong>Straight through</strong>: the striking element beats or passes the ring\'s; the ring counts for nothing and the caster dies. <strong>Wears</strong>: anything else, a bare Ward always; the ring loses the strike\'s power, and a power as high as the ring breaks it and the strike goes through.',
    'A caster with no ring is struck outright. Getting through is death by the striking element.',
    'A ring of two elements uses whichever of them stands best against the strike. A strike of two elements is answered by the better of the ring\'s answers: turned aside if either element would be, straight through only if both would be.',
    `So a full bare Ward (${S.MAX_RING}) falls only to a perfect attack, a ring of the right element shrugs off any power, and a ring of the wrong element is paper. The attacker who does not know the ring is guessing, and the first strike tells.`
  ].map(t => `<li>${t}</li>`).join('');
  const HOW = { strong: 'turns aside', neutral: 'wears', weak: 'straight through' };
  const relationTable = `<table class="deaths"><thead><tr><th>strike \\ ring</th>${S.ELEMENTS.map(e => `<th>${e}</th>`).join('')}<th>bare</th></tr></thead><tbody>${S.ELEMENTS.map(a => `<tr><td>${cap(a)}</td>${S.ELEMENTS.map(r => `<td>${HOW[S.relation(a, r)]}</td>`).join('')}<td>wears</td></tr>`).join('')}</tbody></table>`;
  el('body-rules').insertAdjacentHTML('afterend', relationTable);
  el('deaths').innerHTML = `<thead><tr><th>Element</th><th>Death</th><th>What is said</th></tr></thead><tbody>${S.ELEMENTS.map(e => `<tr><td>${cap(e)}</td><td>${S.DEATHS[e].name}</td><td>${S.DEATHS[e].line}</td></tr>`).join('')}</tbody>`;

  el('monster-list').innerHTML = S.monsters.map(m => `<li><strong>${cap(m.name)}</strong>: ${m.line} It weighs each option at a typical power of 2 and, like any opponent, knows the player's ring only by its thickness until a strike reveals the element (a new ring of another element is a secret again). ${m.elements && m.elements.length ? `It follows ${m.elements.map(e => S.ELEMENT_NAMES[e]).join(' and ')}: a spell, ring or guard of another element costs it ${m.loyalty || 0} in the scoring, so it strays only when nothing of its own can get through. ` : ''}Leans towards ${Object.entries(m.bias).filter(([id]) => S.byId[id]).map(([id, b]) => `${S.byId[id].name} (+${b})`).join(', ')}; draws a working glyph ${Math.round(m.accuracy * 100)}% of the time, at power 1, 2 or 3 with odds ${(m.precision || [1, 0, 0]).map(w => Math.round(w * 100) + '%').join(' / ')}. Each round it scores every option by the expected change in squared marks on both bodies (its own weighted 1.3×, a kill +10, its own death −14) against a belief over the player's next spell (half a count per option, one per past cast, three per cast in the last three rounds, so a player who keeps to one spell is answered within a few rounds), adds its bias and its loyalty, and samples with softmax at temperature ${m.temperature}.</li>`).join('');

  el('recogniser-rules').innerHTML = [
    `<strong>$P point-cloud recogniser</strong> (Vatavu, Anthony and Wobbrock, 2012): ${R.N} resampled points, scaled to a unit box keeping aspect, centred, matched greedily. Strokes may be drawn in any number, order or direction. Rotation matters.`,
    `Two cues from the raw strokes sharpen the match: whether the figure <strong>closes</strong> (start and end within 22% of its size, +0.6 distance on a mismatch) and how many <strong>corners</strong> it has (sharp turns between straight legs, +0.35 per corner of difference).`,
    `A drawing is accepted when its best candidate is within distance <strong>${R.ACCEPT}</strong>; further than that it fizzles. Drawings smaller than 12% of the sheet are smudges and fizzle too. Within ${S.POWER_LEVELS[0].within} the spell has power 3, within ${S.POWER_LEVELS[1].within} power 2.`,
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
    const split = R.splitRing(live), read = split.ring ? split.inner : live;
    const cues = R.cues(read), candidates = R.recognize(read, prepared), best = candidates[0];
    const accepted = best.distance <= R.ACCEPT;
    const name = accepted ? (split.ring && S.byId[best.id].kind === 'attack' ? `Ring of ${S.byId[best.id].name}` : S.byId[best.id].name) : '';
    reading.innerHTML = `${accepted ? `Reads as <strong>${name}</strong> at power ${S.powerFor(best.distance)}` : 'Fizzles'} · ${split.ring ? 'in a ring · ' : ''}${cues.closed ? 'closed' : 'open'}, ${cues.corners} corner${cues.corners === 1 ? '' : 's'}, extent ${Math.round(R.extent(live) / pad.width * 100)}%`;
    list.innerHTML = candidates.map(c => `<li class="${c.distance <= R.ACCEPT ? 'accepted' : ''}">${S.byId[c.id].name}: ${c.distance.toFixed(2)}</li>`).join('');
    frame.classList.toggle('is-set', accepted);
  };
  pad.addEventListener('pointerdown', e => { e.preventDefault(); pad.setPointerCapture(e.pointerId); drawing = true; strokes.push([point(e)]); });
  pad.addEventListener('pointermove', e => { if (!drawing) return; strokes[strokes.length - 1].push(point(e)); paint(); });
  const up = e => { if (!drawing) return; drawing = false; try { pad.releasePointerCapture(e.pointerId); } catch { /* fine */ } paint(); read(); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  el('pad-clear').addEventListener('click', () => { strokes = []; paint(); read(); });
})();
