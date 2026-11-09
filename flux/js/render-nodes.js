// The nodes as SVG: a bar, a label beside it (left column labels to the
// left, right column to the right, hub labels inside when the bar is tall
// enough, otherwise beside), a bracket for an expanded group. Each node is
// focusable with an accessible name, so the keyboard reaches everything.
// Elements are kept by id between frames.

import { s, clear } from './ui/h.js';
import { formatEuros } from './fr.js';

const LABEL_MIN = 11;

export class NodeRenderer {
  constructor(svg, { onSelect, onToggle, onHover }) {
    this.svg = svg;
    this.layer = s('g', { class: 'nodes' });
    this.brackets = s('g', { class: 'brackets' });
    svg.append(this.brackets, this.layer);
    this.els = new Map();
    this.on = { onSelect, onToggle, onHover };
    this.measure = document.createElement('canvas').getContext('2d');
    this.cache = new Map();
    this.font = '';
  }
  resize(width, height) { this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`); this.svg.setAttribute('width', width); this.svg.setAttribute('height', height); this.width = width; this.height = height; this.readFont(); }
  readFont() { const f = getComputedStyle(this.svg).font || '12px system-ui'; if (f !== this.font) { this.font = f; this.cache.clear(); } }
  truncate(text, max) {
    const key = `${text}|${Math.round(max)}`;
    const hit = this.cache.get(key); if (hit !== undefined) return hit;
    this.measure.font = this.font;
    let out = text;
    if (this.measure.measureText(text).width > max) {
      let lo = 0, hi = text.length;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.measure.measureText(text.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1; }
      out = lo > 2 ? text.slice(0, lo).trimEnd() + '…' : '';
    }
    if (this.cache.size > 4000) this.cache.clear();
    this.cache.set(key, out);
    return out;
  }
  draw(layout, { selected = null, hover = null, lit = null, animating = false } = {}) {
    const horizontal = layout.orientation === 'horizontal';
    if (!this.font) this.readFont();
    const seen = new Set();
    const dim = lit && lit.size > 0;
    for (const n of layout.nodes) {
      seen.add(n.id);
      let g = this.els.get(n.id);
      if (!g) {
        g = s('g', { class: 'node', tabindex: n.leaving ? -1 : 0, role: 'button', 'data-id': n.id });
        g.append(s('rect', { class: 'bar', rx: 2 }), s('text', { class: 'label' }), s('text', { class: 'amount' }), s('title'));
        g.addEventListener('click', e => { e.stopPropagation(); if (n.canExpand) this.on.onToggle(n); else this.on.onSelect(n); });
        g.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (n.canExpand) this.on.onToggle(n); else this.on.onSelect(n); } else if (e.key === ' ') { e.preventDefault(); this.on.onSelect(n); } });
        g.addEventListener('pointerenter', () => this.on.onHover(n));
        g.addEventListener('pointerleave', () => this.on.onHover(null));
        g.addEventListener('focus', () => this.on.onHover(n));
        g.addEventListener('blur', () => this.on.onHover(null));
        this.layer.append(g);
        this.els.set(n.id, g);
      }
      g.dataset.sector = n.sector;
      g.classList.toggle('is-selected', selected === n.id);
      g.classList.toggle('is-hover', hover === n.id);
      g.classList.toggle('is-dim', Boolean(dim && !(lit.has(n.id))));
      g.classList.toggle('is-unsplit', Boolean(n.unsplit));
      g.classList.toggle('is-synthetic', Boolean(n.synthetic));
      g.classList.toggle('is-leaving', Boolean(n.leaving));
      g.classList.toggle('can-expand', Boolean(n.canExpand));
      g.style.opacity = n.opacity ?? 1;
      const rect = g.children[0], label = g.children[1], amount = g.children[2], title = g.children[3];
      rect.setAttribute('x', n.x); rect.setAttribute('y', n.y); rect.setAttribute('width', Math.max(0, n.width)); rect.setAttribute('height', Math.max(0, n.height));
      const value = formatEuros(n.value);
      const name = `${n.label}, ${value}`;
      g.setAttribute('aria-label', name + (n.canExpand ? '. Développer' : ''));
      title.textContent = name;
      // Label placement.
      const tall = (horizontal ? n.height : n.width) >= LABEL_MIN;
      const show = tall && !n.leaving && !animating;
      label.style.display = show ? '' : 'none'; amount.style.display = show ? '' : 'none';
      if (show) {
        if (horizontal) {
          const pad = 6;
          let x, anchor, max;
          if (n.column === 0) { x = n.x - pad; anchor = 'end'; max = n.x - pad - 4; }
          else if (n.column === layout.columns - 1 || n.column === 2) { x = n.x + n.width + pad; anchor = 'start'; max = layout.width - x - 4; }
          else { x = n.x + n.width + pad; anchor = 'start'; max = 160; }
          const text = this.truncate(n.short, Math.max(20, max));
          label.setAttribute('x', x); label.setAttribute('text-anchor', anchor);
          const two = n.height >= 2 * LABEL_MIN + 4;
          label.setAttribute('y', two ? n.y + n.height / 2 - 2 : n.y + n.height / 2 + 4);
          label.textContent = text;
          amount.setAttribute('x', x); amount.setAttribute('text-anchor', anchor);
          amount.setAttribute('y', n.y + n.height / 2 + (two ? 12 : 4));
          amount.textContent = two ? value : '';
          if (!two) label.textContent = this.truncate(`${n.short}, ${value}`, Math.max(20, max));
        } else {
          const x = n.x + 4;
          label.setAttribute('x', x); label.setAttribute('text-anchor', 'start'); label.setAttribute('y', n.y + n.height / 2 + 4);
          label.textContent = this.truncate(`${n.short}, ${value}`, Math.max(20, n.width - 8));
          amount.textContent = '';
        }
      }
    }
    for (const [id, g] of this.els) if (!seen.has(id)) { this.els.delete(id); if (g.parentNode) g.parentNode.removeChild(g); }
    // Brackets along expanded groups.
    clear(this.brackets);
    const groups = new Map();
    for (const n of layout.nodes) if (n.group && !n.leaving) { if (!groups.has(n.group)) groups.set(n.group, []); groups.get(n.group).push(n); }
    for (const [key, members] of groups) {
      if (members.length < 2) continue;
      const x0 = Math.min(...members.map(m => m.x)), x1 = Math.max(...members.map(m => m.x + m.width));
      const y0 = Math.min(...members.map(m => m.y)), y1 = Math.max(...members.map(m => m.y + m.height));
      const side = members[0].column === 0 ? 'left' : 'right';
      const bx = horizontal ? (side === 'left' ? x0 - 4 : x1 + 4) : x0 - 4;
      const path = horizontal ? `M${bx + (side === 'left' ? 3 : -3)},${y0 - 3}H${bx}V${y1 + 3}H${bx + (side === 'left' ? 3 : -3)}` : `M${x0 - 3},${y0 - 1}V${y0 - 4}H${x1 + 3}V${y0 - 1}`;
      const bracket = s('path', { class: 'bracket', d: path, 'data-group': key });
      bracket.addEventListener('click', () => { const base = key.split(':').slice(1).join(':'); this.on.onCollapse && this.on.onCollapse(base); });
      this.brackets.append(bracket);
    }
  }
  focus(id) { const g = this.els.get(id); if (g) g.focus(); }
}
