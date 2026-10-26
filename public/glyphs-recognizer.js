'use strict';

// The $P point-cloud recogniser (Vatavu, Anthony and Wobbrock, 2012): a
// drawing and a template are each resampled to a cloud of points, scaled and
// centred, then matched greedily. Stroke count, order and direction do not
// matter; rotation does, so a triangle stays a triangle only apex up.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GlyphsRecognizer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const N = 32;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // Strokes are arrays of [x, y]; the cloud keeps a stroke index per point so
  // resampling never interpolates across a pen lift.
  function cloud(strokes) {
    return strokes.flatMap((stroke, id) => stroke.map(p => [p[0], p[1], id]));
  }
  function pathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) if (points[i][2] === points[i - 1][2]) length += dist(points[i], points[i - 1]);
    return length;
  }
  function resample(points, n) {
    const interval = pathLength(points) / (n - 1);
    if (!(interval > 0)) return Array.from({ length: n }, () => [points[0][0], points[0][1], 0]);
    let D = 0;
    const out = [points[0].slice()];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], cur = points[i];
      if (cur[2] !== prev[2]) continue;
      let d = dist(prev, cur), from = prev;
      while (D + d >= interval && out.length < n) {
        const t = Math.min(Math.max((interval - D) / d, 0), 1);
        const q = [from[0] + t * (cur[0] - from[0]), from[1] + t * (cur[1] - from[1]), cur[2]];
        out.push(q);
        d -= interval - D; D = 0; from = q;
      }
      D += d;
    }
    while (out.length < n) out.push(points[points.length - 1].slice());
    return out;
  }
  function scale(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
    const size = Math.max(maxX - minX, maxY - minY) || 1;
    return points.map(p => [(p[0] - minX) / size, (p[1] - minY) / size, p[2]]);
  }
  function centre(points) {
    const c = points.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map(v => v / points.length);
    return points.map(p => [p[0] - c[0], p[1] - c[1], p[2]]);
  }
  function normalize(strokes, n = N) {
    const points = cloud(strokes.filter(s => s.length));
    if (!points.length) return null;
    return centre(scale(resample(points, n)));
  }
  function cloudDistance(a, b, start) {
    const n = a.length, matched = new Array(n).fill(false);
    let sum = 0, i = start;
    do {
      let index = -1, min = Infinity;
      for (let j = 0; j < n; j++) if (!matched[j]) {
        const d = dist(a[i], b[j]);
        if (d < min) { min = d; index = j; }
      }
      matched[index] = true;
      const weight = 1 - ((i - start + n) % n) / n;
      sum += weight * min;
      i = (i + 1) % n;
    } while (i !== start);
    return sum;
  }
  function greedyMatch(a, b) {
    const n = a.length, step = Math.floor(Math.pow(n, .5));
    let min = Infinity;
    for (let i = 0; i < n; i += step) {
      min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i));
    }
    return min;
  }

  // Point clouds blur corners and the join of a closed figure, so two cues
  // read from the raw strokes sharpen the match: whether the figure closes
  // on itself and how many sharp turns it makes.
  const CLOSE_RATIO = .22, CORNER_ANGLE = Math.PI * .36, LEG_ANGLE = Math.PI * .17, CORNER_WEIGHT = .35, CLOSED_WEIGHT = .6;
  function cues(strokes) {
    const live = strokes.filter(s => s.length > 1);
    const size = extent(live) || 1;
    const first = live[0][0], lastStroke = live[live.length - 1], last = lastStroke[lastStroke.length - 1];
    const closed = dist(first, last) / size < CLOSE_RATIO;
    // A corner is a sharp turn between two straight legs; tight curls, such
    // as the eye of a spiral, keep turning on both sides and do not count.
    let corners = 0;
    for (const stroke of live) {
      const pts = resample(stroke.map(p => [p[0], p[1], 0]), 64);
      const step = 2;
      const turn = i => {
        if (i < step || i >= pts.length - step) return 0;
        const a = [pts[i][0] - pts[i - step][0], pts[i][1] - pts[i - step][1]];
        const b = [pts[i + step][0] - pts[i][0], pts[i + step][1] - pts[i][1]];
        const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
        if (!la || !lb) return 0;
        return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb))));
      };
      const turns = pts.map((_, i) => turn(i));
      let lastCorner = -10;
      for (let i = step; i < pts.length - step; i++) {
        if (turns[i] < CORNER_ANGLE || i - lastCorner <= 2 * step) continue;
        const peak = turns[i] >= (turns[i - 1] || 0) && turns[i] >= (turns[i + 1] || 0);
        const straightLegs = turns[i - 2 * step] < LEG_ANGLE && turns[i + 2 * step] < LEG_ANGLE;
        if (peak && straightLegs) { corners += 1; lastCorner = i; }
      }
    }
    return { closed, corners };
  }

  // Templates: [{ id, strokes }] with as many variants per id as wanted.
  function prepare(templates, n = N) {
    return templates.map(t => ({ id: t.id, points: normalize(t.strokes, n), cues: cues(t.strokes) })).filter(t => t.points);
  }
  // Returns candidates sorted by distance, best first. `score` is 1 for a
  // perfect match and falls to 0 around a distance of 2.
  function recognize(strokes, prepared, n = N) {
    const points = normalize(strokes, n);
    if (!points) return [];
    const drawn = cues(strokes);
    const best = new Map();
    for (const t of prepared) {
      let d = greedyMatch(points, t.points);
      d += CORNER_WEIGHT * Math.abs(drawn.corners - t.cues.corners);
      if (drawn.closed !== t.cues.closed) d += CLOSED_WEIGHT;
      if (!best.has(t.id) || d < best.get(t.id)) best.set(t.id, d);
    }
    return [...best].map(([id, distance]) => ({ id, distance, score: Math.max(0, 1 - distance / 2) })).sort((p, q) => p.distance - q.distance);
  }
  function extent(strokes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) for (const p of s) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
    return strokes.some(s => s.length) ? Math.max(maxX - minX, maxY - minY) : 0;
  }

  // A drawing whose best candidate is further than this is no glyph.
  const ACCEPT = 1.3;

  return { N, ACCEPT, normalize, prepare, recognize, extent, cues };
});
