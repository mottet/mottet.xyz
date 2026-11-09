// The sankey layout: columns at fixed positions, nodes stacked in canonical
// order (never reordered to reduce crossings, so a node keeps its place
// across years and levels), one scale shared by every column, ribbons
// slotted along each node in the order of their counterparts. Pure: the
// same visible graph and size give the same layout. Works horizontally
// (columns left to right) and vertically (bands top to bottom) by
// computing in "u" (along the flow) and "v" (across) and swapping at the
// end.

/**
 * @typedef {{id:string,column:number,label:string,short:string,value:number,in:number,out:number,group?:string,unsplit?:boolean,synthetic?:boolean,sector?:string}} LNodeIn
 * @typedef {{from:string,to:string,keur:number,key:string,sector?:string}} LRibbonIn
 */

export const DEFAULTS = {
  nodeWidth: 16, nodeWidthMobile: 12,
  gap: 8, groupGap: 10, minHeight: 2,
  padU: 24, padV: 12,
  labelGutter: 180, labelGutterMobile: 0,
  minRibbon: 0.5,
};

/**
 * @param {{nodes:LNodeIn[], ribbons:LRibbonIn[], columns:number, width:number, height:number, orientation:'horizontal'|'vertical', options?:object}} input
 */
export function layout({ nodes, ribbons, columns, width, height, orientation = 'horizontal', options = {} }) {
  const o = { ...DEFAULTS, ...options };
  const horizontal = orientation === 'horizontal';
  // Along the flow (u) and across it (v).
  const U = horizontal ? width : height;
  const V = horizontal ? height : width;
  const gutter = horizontal ? o.labelGutter : o.labelGutterMobile;
  const nodeWidth = horizontal ? o.nodeWidth : o.nodeWidthMobile;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const cols = Array.from({ length: columns }, () => []);
  for (const n of nodes) cols[n.column].push(n);

  // Value: what the ribbons carry (max of in and out so a hub node is as
  // tall as the bigger side). Columns keep the input order.
  const inSum = new Map(), outSum = new Map();
  for (const r of ribbons) { outSum.set(r.from, (outSum.get(r.from) || 0) + r.keur); inSum.set(r.to, (inSum.get(r.to) || 0) + r.keur); }
  for (const n of nodes) { n.in = inSum.get(n.id) || 0; n.out = outSum.get(n.id) || 0; n.value = Math.max(n.in, n.out, n.value || 0); }

  // One scale for all columns: the tallest column fits in V.
  const vAvail = V - 2 * o.padV;
  let k = Infinity;
  for (const col of cols) {
    const groups = new Set(col.map(n => n.group).filter(Boolean)).size;
    const gaps = Math.max(0, col.length - 1) * o.gap + groups * o.groupGap;
    const total = col.reduce((s, n) => s + n.value, 0);
    if (total > 0) k = Math.min(k, Math.max(0, vAvail - gaps) / total);
  }
  if (!Number.isFinite(k)) k = 0;

  // Heights with a floor, then re-pack: if the floors overflow, shrink the gaps, then k.
  const heightOf = n => (n.value > 0 ? Math.max(k * n.value, o.minHeight) : o.minHeight);
  let gap = o.gap, groupGap = o.groupGap;
  for (let pass = 0; pass < 3; pass++) {
    let worst = 0;
    for (const col of cols) {
      const groups = new Set(col.map(n => n.group).filter(Boolean)).size;
      const need = col.reduce((s, n) => s + heightOf(n), 0) + Math.max(0, col.length - 1) * gap + groups * groupGap;
      worst = Math.max(worst, need - vAvail);
    }
    if (worst <= 0.5) break;
    if (pass === 0) { gap = Math.max(2, gap / 2); groupGap = Math.max(2, groupGap / 2); }
    else k *= 0.97;
  }

  // Positions along u: columns spread between the gutters.
  const u0 = o.padU + (horizontal ? gutter : 0);
  const u1 = U - o.padU - (horizontal ? gutter : 0) - nodeWidth;
  const uOf = c => (columns === 1 ? (u0 + u1) / 2 : u0 + (c * (u1 - u0)) / (columns - 1));

  const out = new Map();
  for (let c = 0; c < columns; c++) {
    const col = cols[c];
    const groups = new Set(col.map(n => n.group).filter(Boolean)).size;
    const used = col.reduce((s, n) => s + heightOf(n), 0) + Math.max(0, col.length - 1) * gap + groups * groupGap;
    // Centre the column across v.
    let v = o.padV + Math.max(0, (vAvail - used) / 2);
    let lastGroup = null;
    for (const n of col) {
      if (n.group && n.group !== lastGroup) { v += groupGap / 2; }
      if (lastGroup && n.group !== lastGroup && !n.group) { v += groupGap / 2; }
      const h = heightOf(n);
      out.set(n.id, { ...n, u: uOf(c), v, w: nodeWidth, h, inOffset: 0, outOffset: 0 });
      v += h + gap;
      lastGroup = n.group || null;
    }
  }

  // Ribbons: slots along each node in the order of the counterpart's position.
  const placed = [];
  const byFromThenTo = ribbons.slice().sort((a, b) => (out.get(a.to)?.v ?? 0) - (out.get(b.to)?.v ?? 0));
  for (const r of byFromThenTo) {
    const a = out.get(r.from); if (!a) continue;
    const w = Math.max(k * r.keur, r.keur > 0 ? o.minRibbon : 0);
    r._w = w; r._v0 = a.v + a.outOffset; a.outOffset += w;
  }
  const byToThenFrom = ribbons.slice().sort((a, b) => (out.get(a.from)?.v ?? 0) - (out.get(b.from)?.v ?? 0));
  for (const r of byToThenFrom) {
    const b = out.get(r.to); if (!b) continue;
    r._v1 = b.v + b.inOffset; b.inOffset += r._w;
  }
  for (const r of ribbons) {
    const a = out.get(r.from), b = out.get(r.to);
    if (!a || !b) continue;
    placed.push({ key: r.key, from: r.from, to: r.to, keur: r.keur, w: r._w, u0: a.u + a.w, v0: r._v0, u1: b.u, v1: r._v1, sector: r.sector, ribbon: r });
    delete r._w; delete r._v0; delete r._v1;
  }

  // Back to x/y.
  const toXY = (u, v) => (horizontal ? { x: u, y: v } : { x: v, y: u });
  const lnodes = Array.from(out.values()).map(n => {
    const p = toXY(n.u, n.v);
    return { ...n, x: p.x, y: p.y, width: horizontal ? n.w : n.h, height: horizontal ? n.h : n.w };
  });
  const lribbons = placed.map(r => {
    const p0 = toXY(r.u0, r.v0), p1 = toXY(r.u1, r.v1);
    return { ...r, x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, horizontal };
  });
  return { nodes: lnodes, ribbons: lribbons, k, orientation, width, height, nodeWidth, columns, colU: Array.from({ length: columns }, (_, c) => uOf(c)), gutter: horizontal ? gutter : 0 };
}

/** The path of a ribbon as SVG path data (also fed to Path2D). */
export function ribbonPath(r) {
  const w = r.w;
  if (r.horizontal) {
    const xm = (r.x0 + r.x1) / 2;
    return `M${r.x0},${r.y0}C${xm},${r.y0} ${xm},${r.y1} ${r.x1},${r.y1}v${w}C${xm},${r.y1 + w} ${xm},${r.y0 + w} ${r.x0},${r.y0 + w}Z`;
  }
  const ym = (r.y0 + r.y1) / 2;
  return `M${r.x0},${r.y0}C${r.x0},${ym} ${r.x1},${ym} ${r.x1},${r.y1}h${w}C${r.x1 + w},${ym} ${r.x0 + w},${ym} ${r.x0 + w},${r.y0}Z`;
}
