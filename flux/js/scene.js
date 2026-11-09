// The chart: a canvas for the ribbons under an SVG for the nodes, sized to
// its container, animated between layouts, with hover picking on both.

import { layout as computeLayout } from './layout.js';
import { interpolate, easeOutCubic } from './interpolate.js';
import { RibbonRenderer } from './render-ribbons.js';
import { NodeRenderer } from './render-nodes.js';

const DURATION = 380;
export const ZOOM_MAX = 8, ZOOM_STEP = 1.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
      onFocus: n => handlers.onFocus && handlers.onFocus(n),
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
    this.zoom = 1;
    window.addEventListener('scroll', () => this.scrolled(), { passive: true });
    this.gestures();
    this.measure(false);
  }
  /**
   * Zoom makes the chart taller (the page scrolls through it), so thin flows
   * get room and a label while the text keeps its size. The point under
   * `anchorY` (a viewport y, default the middle of what is visible) stays put.
   */
  setZoom(z, anchorY, { quiet = false } = {}) {
    z = clamp(Math.round(z * 100) / 100, 1, ZOOM_MAX);
    if (z === this.zoom) return;
    const before = this.container.getBoundingClientRect();
    const a = anchorY ?? clamp(window.innerHeight / 2, before.top, before.bottom);
    const f = before.height ? clamp((a - before.top) / before.height, 0, 1) : 0.5;
    this.zoom = z;
    this.container.style.setProperty('--zoom', String(z));
    cancelAnimationFrame(this.raf); if (this.target) { this.current = this.target; this.target = null; this.previous = null; this.frame = null; this.t = 1; }
    this.measure(true);
    const after = this.container.getBoundingClientRect();
    window.scrollBy(0, after.top + f * after.height - a);
    if (!quiet && this.handlers.onZoom) this.handlers.onZoom(z);
  }
  zoomBy(factor, anchorY) { this.setZoom(this.zoom * factor, anchorY); }
  /** Pinch with two fingers, ctrl + wheel (trackpad pinch); one finger still scrolls the page. */
  gestures() {
    const el = this.container;
    let pinch = null, raf = 0;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    el.addEventListener('touchstart', e => { if (e.touches.length === 2) { pinch = { d: dist(e.touches), z: this.zoom }; this.pinching = true; e.preventDefault(); } }, { passive: false });
    el.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const z = pinch.z * dist(e.touches) / pinch.d, y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.setZoom(z, y, { quiet: true }));
    }, { passive: false });
    const end = e => { if (pinch && e.touches.length < 2) { pinch = null; this.pinching = false; this.suppressClick = performance.now(); this.paint(); if (this.handlers.onZoom) this.handlers.onZoom(this.zoom); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    el.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY / 200), e.clientY); }, { passive: false });
    // A click that ends a pinch is not a click.
    el.addEventListener('click', e => { if (this.suppressClick && performance.now() - this.suppressClick < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
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
  /** Phones: no label gutters, the labels sit beside the bars over the ribbons. */
  compact() { return this.width < 700; }
  /** Lays out a visible graph and animates to it. */
  show(input, { animate = true } = {}) {
    this.input = input;
    const next = computeLayout({ nodes: input.nodes.map(n => ({ ...n })), ribbons: input.ribbons.map(r => ({ ...r })), columns: input.columns, width: this.width, height: this.height, orientation: 'horizontal', options: this.compact() ? { padU: 4, padV: 10, labelGutter: 0, nodeWidth: 10, gap: 6 } : {} });
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
    this.ribbons.draw(frame, { lit, pick: !animating && !this.pinching });
    this.drawNodes(frame, lit, animating);
  }
  drawNodes(frame, lit, animating) { this.nodes.draw(frame, { selected: this.selected, hover: this.hoverNode, lit, animating, visible: this.visible() }); }
  /** The band of the chart that is on screen, in chart coordinates (null when all of it is). */
  visible() {
    const r = this.container.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return null;
    return [Math.max(0, -r.top), Math.min(r.height, window.innerHeight - r.top)];
  }
  /** Scrolling through a tall chart: the labels follow, the ribbons stay as drawn. */
  scrolled() {
    if (this.scrollRaf || this.target || !this.current) return;
    this.scrollRaf = requestAnimationFrame(() => { this.scrollRaf = 0; if (!this.target && this.current) this.drawNodes(this.current, this.litSet(this.current), false); });
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
