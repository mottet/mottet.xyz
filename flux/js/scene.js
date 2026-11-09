// The chart: a canvas for the ribbons under an SVG for the nodes, sized to
// its container, animated between layouts, with hover picking on both.

import { layout as computeLayout } from './layout.js';
import { interpolate, easeOutCubic } from './interpolate.js';
import { RibbonRenderer } from './render-ribbons.js';
import { NodeRenderer } from './render-nodes.js';

const DURATION = 380;

export class Scene {
  constructor(container, handlers) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ribbons';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'nodes-layer');
    this.svg.setAttribute('aria-label', 'Diagramme des flux');
    container.append(this.canvas, this.svg);
    this.ribbons = new RibbonRenderer(this.canvas);
    this.nodes = new NodeRenderer(this.svg, {
      onSelect: n => handlers.onSelect(n),
      onToggle: n => handlers.onToggle(n),
      onCollapse: base => handlers.onCollapse && handlers.onCollapse(base),
      onHover: n => { this.hoverNode = n ? n.id : null; this.hoverRibbon = null; handlers.onHover(n ? { node: n } : null); this.paint(); },
    });
    this.handlers = handlers;
    this.current = null; this.previous = null; this.target = null;
    this.t = 1; this.start = 0; this.raf = 0;
    this.hoverNode = null; this.hoverRibbon = null; this.selected = null;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ro = new ResizeObserver(() => this.measure(true));
    this.ro.observe(container);
    this.canvas.addEventListener('pointermove', e => this.pointer(e));
    this.canvas.addEventListener('pointerleave', () => { if (this.hoverRibbon) { this.hoverRibbon = null; handlers.onHover(null); this.paint(); } });
    this.canvas.addEventListener('click', e => { const r = this.ribbonAt(e); if (r) handlers.onRibbon(r); else handlers.onSelect(null); });
    this.measure(false);
  }
  measure(relayout) {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width)), height = Math.max(240, Math.floor(rect.height));
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    this.ribbons.resize(width, height); this.nodes.resize(width, height);
    this.ribbons.readTheme();
    if (relayout && this.input) this.show(this.input, { animate: false });
    else this.paint();
  }
  theme() { this.ribbons.readTheme(); this.paint(); }
  orientation() { return this.width < 700 ? 'vertical' : 'horizontal'; }
  /** Lays out a visible graph and animates to it. */
  show(input, { animate = true } = {}) {
    this.input = input;
    const next = computeLayout({ nodes: input.nodes.map(n => ({ ...n })), ribbons: input.ribbons.map(r => ({ ...r })), columns: input.columns, width: this.width, height: this.height, orientation: this.orientation(), options: this.width < 700 ? { padU: 56, padV: 8 } : {} });
    for (const n of next.nodes) n.leaving = false;
    if (!animate || this.reduced || !this.current) { this.current = next; this.previous = null; this.target = null; this.t = 1; this.paint(); return; }
    this.previous = this.frame || this.current; this.target = next; this.t = 0; this.start = performance.now();
    cancelAnimationFrame(this.raf);
    const step = now => {
      this.t = Math.min(1, (now - this.start) / DURATION);
      if (this.t >= 1) { this.current = this.target; this.previous = null; this.target = null; this.frame = null; this.paint(); this.handlers.onSettle && this.handlers.onSettle(); return; }
      this.paint();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  paint() {
    if (!this.current || this.painting) return;
    this.painting = true;
    try { this.paintNow(); } finally { this.painting = false; }
  }
  paintNow() {
    let frame = this.current, animating = false;
    if (this.target) { frame = interpolate(this.previous, this.target, easeOutCubic(this.t), id => this.relatives(id)); animating = true; this.frame = frame; }
    const lit = this.litSet(frame);
    this.ribbons.draw(frame, { lit, pick: !animating });
    this.nodes.draw(frame, { selected: this.selected, hover: this.hoverNode, lit, animating });
  }
  relatives(id) { return this.handlers.relatives ? this.handlers.relatives(id) : []; }
  /** What lights up: the hovered node's ribbons and their other ends, or the hovered ribbon and its ends. */
  litSet(frame) {
    const key = this.hoverNode || this.selected;
    const lit = new Set();
    if (this.hoverRibbon) { lit.add(this.hoverRibbon.key); lit.add(this.hoverRibbon.from); lit.add(this.hoverRibbon.to); return lit; }
    if (!key) return lit;
    lit.add(key);
    for (const r of frame.ribbons) if (r.from === key || r.to === key) { lit.add(r.key); lit.add(r.from); lit.add(r.to); }
    return lit;
  }
  ribbonAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    return this.ribbons.at(e.clientX - rect.left, e.clientY - rect.top);
  }
  pointer(e) {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      const r = this.ribbonAt(e);
      const key = r ? r.key : null;
      if (key !== (this.hoverRibbon ? this.hoverRibbon.key : null)) {
        this.hoverRibbon = r;
        this.handlers.onHover(r ? { ribbon: r, x: e.clientX, y: e.clientY } : null);
        this.paint();
      } else if (r) this.handlers.onHoverMove && this.handlers.onHoverMove(e.clientX, e.clientY);
    });
  }
  select(id) { this.selected = id; this.paint(); }
  nodeAt(id) { return this.current ? this.current.nodes.find(n => n.id === id) : null; }
}
