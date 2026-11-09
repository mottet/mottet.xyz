// The visualisation benchmark: the same visible graph (built by the site's
// own model from the real shards) handed to three renderers — the site's
// layout with canvas ribbons and SVG nodes, d3-sankey on SVG, Apache
// ECharts' sankey on canvas — and timed: layout, first paint, frames while
// the data changes year after year (the ribbons morph), hover latency.
// ?candidate=custom|d3|echarts&scenario=L0|L1|L2|L3&runs=20
import { Data } from '../js/data.js';
import { Model } from '../js/model.js';
import { buildView } from '../js/view.js';
import { layout, ribbonPath } from '../js/layout.js';
import { RibbonRenderer } from '../js/render-ribbons.js';
import { NodeRenderer } from '../js/render-nodes.js';

const q = new URLSearchParams(location.search);
const candidate = q.get('candidate') || 'custom';
const scenario = q.get('scenario') || 'L1';
const runs = Number(q.get('runs') || 10);
const stage = document.getElementById('stage');
const out = document.getElementById('out');
const W = stage.clientWidth, H = stage.clientHeight;
const log = s => { out.textContent += s + '\n'; };
const stats = a => { const s = a.slice().sort((x, y) => x - y); const p = k => s[Math.min(s.length - 1, Math.floor(k * s.length))]; return { p50: +p(0.5).toFixed(2), p95: +p(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2), n: s.length }; };
const frames = [];
let rafOn = false, last = 0;
const sampler = now => { if (last) frames.push(now - last); last = now; if (rafOn) requestAnimationFrame(sampler); };

const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });

async function main() {
  const data = new Data('../graph/');
  const index = await data.loadIndex();
  const model = new Model(await data.nodes());
  for (const y of index.years) model.addEdges(`${y}/sna`, await data.edges(y, 'sna'));
  const levels = { L0: 0, L1: 1, L2: 2, L3: 3 };
  const views = index.years.map(year => buildView(model, { year, basis: 'sna', hubLevel: levels[scenario] ?? 1, expanded: [], ops: scenario === 'L3' }));
  const v0 = views[views.length - 1];
  log(`candidate ${candidate}, scenario ${scenario}: ${v0.nodes.length} nodes, ${v0.ribbons.length} ribbons, ${W}x${H}`);
  const adapters = { custom, d3: d3sankey, echarts };
  const a = await adapters[candidate]();
  // Layout + first paint.
  const tl = [], tp = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); const L = a.layout(v0); const t1 = performance.now(); a.paint(L); const t2 = performance.now(); tl.push(t1 - t0); tp.push(t2 - t1); }
  // Frames while morphing between years (one layout per frame, like an animation).
  rafOn = true; requestAnimationFrame(sampler);
  const t0 = performance.now(); let i = 0;
  await new Promise(resolve => { const step = () => { const v = views[i++ % views.length]; a.paint(a.layout(v)); if (performance.now() - t0 < 2500) requestAnimationFrame(step); else resolve(); }; requestAnimationFrame(step); });
  rafOn = false;
  // Hover latency: pointer moves over the stage, time until the adapter reports a hit.
  const th = [];
  for (let k = 0; k < 60; k++) { const x = 100 + Math.random() * (W - 200), y = 20 + Math.random() * (H - 40); const s0 = performance.now(); a.hover(x, y); th.push(performance.now() - s0); }
  const result = { candidate, scenario, nodes: v0.nodes.length, ribbons: v0.ribbons.length, layoutMs: stats(tl), paintMs: stats(tp), frameMs: stats(frames), longFrames: frames.filter(f => f > 16.7).length, hoverMs: stats(th), bytes: a.bytes, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
  window.__bench = result;
  log(JSON.stringify(result, null, 1));
}

async function custom() {
  const canvas = document.createElement('canvas'); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'nodes-layer');
  stage.classList.add('chart'); stage.append(canvas, svg);
  const rr = new RibbonRenderer(canvas); rr.resize(W, H); rr.readTheme();
  const nr = new NodeRenderer(svg, { onSelect() {}, onToggle() {}, onHover() {} }); nr.resize(W, H);
  let L0 = null;
  const lay = v => (L0 = layout({ nodes: v.nodes.map(n => ({ ...n })), ribbons: v.ribbons.map(r => ({ ...r })), columns: 3, width: W, height: H, orientation: 'horizontal' }));
  return { bytes: 0, layout: lay, paint: L => { rr.draw(L, { pick: false }); nr.draw(L, { animating: true }); }, hover: (x, y) => { rr.draw(L0, { pick: true }); return rr.at(x, y); } };
}

async function d3sankey() {
  await loadScript('vendor/d3.min.js'); await loadScript('vendor/d3-sankey.min.js');
  const svg = d3.select(stage).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  const gl = svg.append('g'), gn = svg.append('g');
  const sk = d3.sankey().nodeId(d => d.id).nodeWidth(16).nodePadding(8).nodeSort(null).linkSort(null).extent([[180, 12], [W - 180, H - 12]]);
  let current = null;
  return {
    bytes: 0,
    layout: v => sk({ nodes: v.nodes.map(n => ({ id: n.id, name: n.short, sector: n.sector })), links: v.ribbons.map(r => ({ source: r.from, target: r.to, value: Math.max(1, r.keur), key: r.key })) }),
    paint: L => {
      current = L;
      gl.selectAll('path').data(L.links, d => d.key).join('path').attr('d', d3.sankeyLinkHorizontal()).attr('fill', 'none').attr('stroke', '#c98a2b').attr('stroke-opacity', 0.5).attr('stroke-width', d => Math.max(0.5, d.width));
      const n = gn.selectAll('g').data(L.nodes, d => d.id).join(enter => { const g = enter.append('g'); g.append('rect'); g.append('text'); return g; });
      n.select('rect').attr('x', d => d.x0).attr('y', d => d.y0).attr('width', d => d.x1 - d.x0).attr('height', d => Math.max(1, d.y1 - d.y0)).attr('fill', '#39527a');
      n.select('text').attr('x', d => d.x1 + 6).attr('y', d => (d.y0 + d.y1) / 2).text(d => d.name).style('font', '12px sans-serif');
    },
    hover: (x, y) => { const el = document.elementFromPoint(x + stage.getBoundingClientRect().left, y + stage.getBoundingClientRect().top); return el && el.tagName === 'path' ? el : null; },
  };
}

async function echarts() {
  await loadScript('vendor/echarts.min.js');
  const el = document.createElement('div'); el.className = 'echarts'; stage.append(el);
  const chart = window.echarts.init(el, null, { renderer: 'canvas' });
  return {
    bytes: 0,
    layout: v => ({ series: [{ type: 'sankey', layout: 'none', nodeAlign: 'justify', nodeWidth: 16, nodeGap: 8, emphasis: { focus: 'adjacency' }, data: v.nodes.map(n => ({ name: n.id, label: { formatter: n.short } })), links: v.ribbons.map(r => ({ source: r.from, target: r.to, value: Math.max(1, r.keur) })), lineStyle: { color: 'source', opacity: 0.5, curveness: 0.5 } }], animation: false }),
    paint: opt => chart.setOption(opt, { notMerge: true, lazyUpdate: false }),
    hover: (x, y) => { chart.dispatchAction({ type: 'showTip', x, y }); return true; },
  };
}

main().catch(e => { log('ERROR ' + e.message); window.__bench = { error: e.message }; });
