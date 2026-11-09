// The ribbons on a canvas, plus a hidden picking canvas where each ribbon
// is drawn in its own colour so a pointer position maps to a ribbon in
// one getImageData. Colours come from the CSS custom properties of the
// document, so the theme drives them.

import { ribbonPath } from './layout.js';

export class RibbonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pick = document.createElement('canvas');
    this.pickCtx = this.pick.getContext('2d', { willReadFrequently: true });
    this.colors = {};
    this.dpr = 1;
    this.paths = [];
  }
  readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const get = name => cs.getPropertyValue(name).trim();
    this.colors = {
      households: get('--c-households'), firms: get('--c-firms'), finance: get('--c-finance'), nonprofit: get('--c-nonprofit'), world: get('--c-world'), debt: get('--c-debt'), imputed: get('--c-imputed'), products: get('--c-products'),
      central: get('--c-central'), local: get('--c-local'), social: get('--c-social'), hub: get('--c-hub'), other: get('--c-other'),
    };
    this.alpha = Number(get('--ribbon-alpha')) || 0.55;
  }
  resize(width, height) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.pick]) { c.width = Math.round(width * this.dpr); c.height = Math.round(height * this.dpr); }
    this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`;
    this.width = width; this.height = height;
  }
  /** @param {{ribbons:any[]}} layout @param {{hover?:string, lit?:Set<string>}} state */
  draw(layout, { hover = null, lit = null, pick = true } = {}) {
    const { ctx, pickCtx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (pick) { pickCtx.setTransform(dpr, 0, 0, dpr, 0, 0); pickCtx.clearRect(0, 0, this.width, this.height); this.paths = []; }
    const dim = lit && lit.size > 0;
    let i = 0;
    for (const r of layout.ribbons) {
      if (!(r.w > 0)) continue;
      const path = new Path2D(ribbonPath(r));
      if (pick) this.paths.push({ key: r.key, path, r });
      const color = this.colors[r.sector] || this.colors.other;
      const isLit = !dim || (lit.has(r.key));
      ctx.globalAlpha = (r.appearing ? 0.6 : 1) * (isLit ? (dim ? 0.92 : this.alpha) : 0.12);
      ctx.fillStyle = color;
      ctx.fill(path);
      if (r.sector === 'imputed') { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = color; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.stroke(path); ctx.restore(); }
      if (r.sector === 'debt') { ctx.save(); ctx.globalAlpha = isLit ? 0.9 : 0.2; ctx.strokeStyle = color; ctx.setLineDash([6, 4]); ctx.lineWidth = 1; ctx.stroke(path); ctx.restore(); }
      if (pick) { i++; pickCtx.fillStyle = `rgb(${i & 255},${(i >> 8) & 255},${(i >> 16) & 255})`; pickCtx.fill(path); }
    }
    ctx.globalAlpha = 1;
  }
  /** The ribbon under a CSS pixel position, or null. */
  at(x, y) {
    if (!this.paths.length) return null;
    const px = Math.round(x * this.dpr), py = Math.round(y * this.dpr);
    if (px < 0 || py < 0 || px >= this.pick.width || py >= this.pick.height) return null;
    const d = this.pickCtx.getImageData(px, py, 1, 1).data;
    if (d[3] === 0) return null;
    const id = d[0] | (d[1] << 8) | (d[2] << 16);
    return this.paths[id - 1] ? this.paths[id - 1].r : null;
  }
}
