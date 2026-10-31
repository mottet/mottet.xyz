'use strict';

// The element wheel: who beats whom, drawn from the rules. An arrow points
// at the element it beats; a quench is two arrows that stop each other in the
// middle, a pass two arrows that cross and each reach the other element.
// Shared by the game page, the grimoire and the forge. Strings only, no DOM;
// the forge wires clicks onto the nodes it gets back.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlyphsWheel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const f = n => n.toFixed(1);

  function svg(S, opts = {}) {
    const { id = 'wheel', interactive = false, size = 360, selected = null } = opts;
    const elements = S.ELEMENTS, n = elements.length;
    const c = size / 2, R = size * .34, r = Math.min(size * .1, size * .9 / Math.max(3, n));
    const pos = Object.fromEntries(elements.map((e, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [e, [c + R * Math.cos(a), c + R * Math.sin(a)]];
    }));
    const name = e => cap(S.ELEMENT_NAMES[e]);
    const markers = elements.map(e => `<marker id="${id}-arrow-${e}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${S.ELEMENT_COLOURS[e]}"/></marker>`).join('');
    const edges = S.relations.map(rel => {
      const P = pos[rel.from], Q = pos[rel.to];
      const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const pair = `${rel.from} ${rel.to}`;
      if (rel.kind === 'beats') {
        const a = [P[0] + ux * (r + 3), P[1] + uy * (r + 3)], b = [Q[0] - ux * (r + 8), Q[1] - uy * (r + 8)];
        return `<line class="wheel-edge wheel-beats" data-pair="${pair}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${S.ELEMENT_COLOURS[rel.from]}" stroke-width="3.5" stroke-linecap="round" marker-end="url(#${id}-arrow-${rel.from})"><title>${esc(name(rel.from))} beats ${esc(S.ELEMENT_NAMES[rel.to])}</title></line>`;
      }
      // Quench: two arrows, one from each element, that stop each other in the
      // middle. Pass: two arrows, one each way, side by side, each reaching
      // the other element. The label sits beside the line, away from the centre.
      const mid = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
      const side = (-uy) * (mid[0] - c) + ux * (mid[1] - c) >= 0 ? 1 : -1;
      const px = -uy * side, py = ux * side;
      const label = rel.kind, w = label.length * 7 + 14, L = [mid[0] + px * 34, mid[1] + py * 34];
      const colourFrom = S.ELEMENT_COLOURS[rel.from], colourTo = S.ELEMENT_COLOURS[rel.to];
      const arrow = (x1, y1, x2, y2, colour, el) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${colour}" stroke-width="3" stroke-linecap="round" marker-end="url(#${id}-arrow-${el})"/>`;
      let lines;
      if (rel.kind === 'quench') {
        const gap = 5;
        lines = arrow(P[0] + ux * (r + 3), P[1] + uy * (r + 3), mid[0] - ux * gap, mid[1] - uy * gap, colourFrom, rel.from)
          + arrow(Q[0] - ux * (r + 3), Q[1] - uy * (r + 3), mid[0] + ux * gap, mid[1] + uy * gap, colourTo, rel.to);
      } else {
        const d = 6;
        lines = arrow(P[0] + ux * (r + 3) + px * d, P[1] + uy * (r + 3) + py * d, Q[0] - ux * (r + 8) + px * d, Q[1] - uy * (r + 8) + py * d, colourFrom, rel.from)
          + arrow(Q[0] - ux * (r + 3) - px * d, Q[1] - uy * (r + 3) - py * d, P[0] + ux * (r + 8) - px * d, P[1] + uy * (r + 8) - py * d, colourTo, rel.to);
      }
      const says = rel.kind === 'quench' ? 'quench each other: their arrows stop each other in the middle' : 'pass through each other: their arrows cross and each reaches the other';
      return `<g class="wheel-edge wheel-${rel.kind}" data-pair="${pair}">${lines}<rect class="wheel-tag" x="${f(L[0] - w / 2)}" y="${f(L[1] - 9)}" width="${w}" height="18" rx="9"/><text class="wheel-tag-text" x="${f(L[0])}" y="${f(L[1] + 4)}" text-anchor="middle">${label}</text><title>${esc(name(rel.from))} and ${esc(S.ELEMENT_NAMES[rel.to])} ${says}</title></g>`;
    }).join('');
    const nodes = elements.map(e => {
      const [x, y] = pos[e], label = name(e), font = label.length > 7 ? Math.max(10, r * .36) : r * .44;
      const on = selected === e ? ' is-selected' : '';
      return `<g class="wheel-node${on}" data-id="${e}" transform="translate(${f(x)} ${f(y)})"${interactive ? ' tabindex="0" role="button"' : ''}><title>${esc(label)}</title><circle r="${f(r)}" fill="${S.ELEMENT_COLOURS[e]}"/><text y="${f(font * .35)}" text-anchor="middle" font-size="${f(font)}">${esc(label)}</text></g>`;
    }).join('');
    const title = elements.map(e => `${name(e)} beats ${S.beats[e].map(b => S.ELEMENT_NAMES[b]).join(' and ') || 'nothing'}`).join('. ');
    return `<svg class="wheel-svg${interactive ? ' is-interactive' : ''}" viewBox="0 0 ${size} ${size}" role="img" aria-label="The elements. ${esc(title)}."><defs>${markers}</defs>${edges}${nodes}</svg>`;
  }

  // The same wheel in sentences, one per line of the drawing, for the
  // grimoire and for screen readers.
  function legend(S) {
    const name = e => cap(S.ELEMENT_NAMES[e]), low = e => esc(S.ELEMENT_NAMES[e]);
    const lines = [];
    for (const e of S.ELEMENTS) for (const b of S.beats[e]) lines.push(`<strong style="color:${S.ELEMENT_COLOURS[e]}">${esc(name(e))}</strong> beats ${low(b)}: ${low(e)} overcomes ${low(b)} and goes on; a ring of ${low(e)} turns ${low(b)} aside; ${low(e)} goes straight through a ring of ${low(b)}.`);
    for (const rel of S.relations) {
      if (rel.kind === 'quench') lines.push(`<strong>${esc(name(rel.from))} and ${low(rel.to)}</strong> quench each other: the two spells undo each other; a ring of either turns the other aside.`);
      if (rel.kind === 'pass') lines.push(`<strong>${esc(name(rel.from))} and ${low(rel.to)}</strong> pass through each other: both spells go on; each goes straight through a ring of the other.`);
    }
    const loose = [];
    S.ELEMENTS.forEach((a, i) => S.ELEMENTS.slice(i + 1).forEach(b => { if (S.relationKind(a, b) === 'none') loose.push(`${name(a)} and ${S.ELEMENT_NAMES[b]}`); }));
    if (loose.length) lines.push(`<strong>Nothing between ${esc(loose.join(', '))}</strong>: both spells go on; a ring of either takes the other's blow and wears.`);
    lines.push('<strong>An element against itself</strong>: both spells go on; a ring of it takes the blow and wears.');
    return lines.map(l => `<li>${l}</li>`).join('');
  }

  // What the wheel means in play, short enough for the game page.
  function rules(S) {
    return [
      '<strong>Two spells meet on the wheel.</strong> Arrow: the winner\'s spell goes on to the loser; the loser\'s is gone. Dashed: both spells are undone. Dotted, the same element, or no line: both go on.',
      '<strong>A spell that reaches a caster with no ring kills.</strong>',
      `<strong>A ring is 1 to ${S.MAX_RING} thick</strong>, as clean as the glyph that raised it. It stops any element its own element beats or quenches, and is not worn by it. An element that beats or passes the ring's goes straight through: death.`,
      'Any other element wears the ring by the spell\'s power. A power as high as the ring breaks it, and the spell goes through.',
      'A bare circle thickens the ring that stands. The same element again thickens it; another element replaces it. The other caster sees how thick your ring is, never what it is made of, until a spell meets it.',
      `<strong>A spell of two elements</strong> meets another spell with whichever of its elements fares better, and pays for it twice: a ring that turns either of its elements aside turns the whole spell aside, and it goes straight through only where both would; and it is cast ${S.COMPOUND_COST === 1 ? 'one power' : `${S.COMPOUND_COST} power`} below the hand that drew it${S.COMPOUND_COST >= 1 ? ', so it is never perfect' : ''}.`
    ].map(l => `<li>${l}</li>`).join('');
  }

  return { svg, legend, rules };
});
