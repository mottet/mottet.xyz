// Morphing from one layout to the next: nodes present in both slide and
// resize; a node that appears grows out of the place of its nearest
// relative in the old layout (its parent when it was just expanded, else
// its position in the new layout at zero height); a node that goes shrinks
// into its relative in the new layout. Ribbons follow their ends.

const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/** @param {(id:string)=>string[]} relatives ids to try, nearest first, for a node missing on one side */
export function interpolate(prev, next, t, relatives = () => []) {
  if (!prev || t >= 1) return next;
  const pn = new Map(prev.nodes.map(n => [n.id, n]));
  const nn = new Map(next.nodes.map(n => [n.id, n]));
  const findPrev = id => { for (const r of relatives(id)) if (pn.has(r)) return pn.get(r); return null; };
  const findNext = id => { for (const r of relatives(id)) if (nn.has(r)) return nn.get(r); return null; };
  const start = new Map(); // id -> {x,y,width,height} the node morphs from
  const nodes = next.nodes.map(n => {
    let from = pn.get(n.id);
    if (!from) { const rel = findPrev(n.id); from = rel ? { x: rel.x, y: rel.y + rel.height / 2, width: rel.width, height: 0 } : { ...n, height: 0 }; }
    start.set(n.id, from);
    return { ...n, x: lerp(from.x, n.x, t), y: lerp(from.y, n.y, t), width: lerp(from.width, n.width, t), height: lerp(from.height, n.height, t), appearing: !pn.has(n.id) };
  });
  // Nodes on their way out, drawn fading into their relative.
  const leaving = prev.nodes.filter(n => !nn.has(n.id)).map(n => {
    const rel = findNext(n.id);
    const to = rel ? { x: rel.x, y: rel.y + rel.height / 2, width: rel.width, height: 0 } : { ...n, height: 0 };
    return { ...n, x: lerp(n.x, to.x, t), y: lerp(n.y, to.y, t), width: lerp(n.width, to.width, t), height: lerp(n.height, to.height, t), leaving: true, opacity: 1 - t };
  });
  const pr = new Map(prev.ribbons.map(r => [r.key, r]));
  const ribbons = next.ribbons.map(r => {
    const from = pr.get(r.key);
    if (from) return { ...r, x0: lerp(from.x0, r.x0, t), y0: lerp(from.y0, r.y0, t), x1: lerp(from.x1, r.x1, t), y1: lerp(from.y1, r.y1, t), w: lerp(from.w, r.w, t) };
    const a = start.get(r.from), b = start.get(r.to);
    const f = { x0: a ? a.x + a.width : r.x0, y0: a ? a.y : r.y0, x1: b ? b.x : r.x1, y1: b ? b.y : r.y1, w: 0 };
    return { ...r, x0: lerp(f.x0, r.x0, t), y0: lerp(f.y0, r.y0, t), x1: lerp(f.x1, r.x1, t), y1: lerp(f.y1, r.y1, t), w: lerp(0, r.w, t), appearing: true };
  });
  return { ...next, nodes: nodes.concat(leaving), ribbons };
}
