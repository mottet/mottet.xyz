// Flux: boot. Loads the index, the nodes and the current year's edges,
// wires the state to the chart and the panels, keeps the address bar in
// step, and registers the service worker.

import { Data } from './js/data.js';
import { Model, HUB } from './js/model.js';
import { buildView } from './js/view.js';
import { Scene } from './js/scene.js';
import { createStore } from './js/store.js';
import { encode, decode } from './js/url-state.js';
import { formatEuros, formatNumber, T, BASES, NBSP } from './js/fr.js';
import { h, clear } from './js/ui/h.js';
import { detailsPanel, sourcesPanel, tableView, tooltip, toast } from './js/ui/panels.js';

const TAG = document.documentElement.dataset.tag || 'flux-1';
const $ = sel => document.querySelector(sel);

async function main() {
  const data = new Data('graph/');
  const index = await data.loadIndex();
  const years = index.years;
  const basesInfo = Array.isArray(index.bases) ? Object.fromEntries(index.bases.map(b => [b, { root: HUB, years }])) : index.bases;
  const bases = Object.keys(basesInfo);
  const rootOf = basis => (basesInfo[basis] && basesInfo[basis].root) || HUB;
  const yearsOf = basis => (basesInfo[basis] && basesInfo[basis].years) || years;
  const defaultYear = index.defaultYear || years[years.length - 1];
  const initial = decode(location.search, { years, bases, defaults: { year: defaultYear, basis: 'sna', hubLevel: 0, expanded: [], ops: false, selected: null, theme: 'auto' } });
  const store = createStore({ ...initial, hover: null, sourcesOpen: false, tableOpen: false, loading: true });
  applyTheme(initial.theme);

  const [nodes, prov] = await Promise.all([data.nodes(), data.provenance()]);
  const model = new Model(nodes);
  const ensureEdges = async (year, basis) => { const key = `${year}/${basis}`; if (!model.hasEdges(key)) { const edges = await data.edges(year, basis); if (edges) model.addEdges(key, edges); } };
  await ensureEdges(initial.year, initial.basis);

  // The chart.
  const chartEl = $('#chart');
  let view = null;
  const tip = tooltip($('#tooltip'));
  const scene = new Scene(chartEl, {
    onSelect: n => store.set({ selected: n ? n.id : null, ribbonSel: null }),
    onToggle: n => toggle(n.base),
    onCollapse: base => toggle(base),
    onRibbon: r => store.set({ ribbonSel: r, selected: null }),
    onHover: hv => {
      if (!hv) { tip.hide(); return; }
      if (hv.node) {
        const n = hv.node; const node = scene.nodeAt(n.id); if (!node) { tip.hide(); return; }
        const r = chartEl.getBoundingClientRect();
        const inR = view.ribbons.filter(x => x.to === n.id).reduce((a, x) => a + x.keur, 0), outR = view.ribbons.filter(x => x.from === n.id).reduce((a, x) => a + x.keur, 0);
        tip.show(h('div', h('strong', n.label), inR ? h('div', `${T.in} ${formatEuros(inR)}`) : null, outR ? h('div', `${T.out} ${formatEuros(outR)}`) : null, h('div.hint', n.canExpand ? (n.expanded ? 'Cliquer pour replier' : 'Cliquer pour développer, Espace pour le détail') : 'Cliquer pour le détail')), r.left + node.x + node.width, r.top + node.y);
        return;
      }
      if (hv.ribbon) {
        const r = hv.ribbon.ribbon || hv.ribbon;
        const name = id => view.nodes.find(x => x.id === id)?.short || id;
        tip.show(h('div', h('strong', `${name(r.from)} → ${name(r.to)}`), h('div.amt', formatEuros(r.keur)), h('ul', r.ops.slice(0, 4).map(o => h('li', `${o.label || o.op} : ${formatEuros(o.keur)}`)), r.ops.length > 4 ? h('li', `… et ${r.ops.length - 4} autres`) : null)), hv.x, hv.y);
      } else tip.hide();
    },
    onHoverMove: (x, y) => tip.move(x, y),
    relatives: id => { const [side, node] = [id.split(':')[0], id.split(':').slice(1).join(':')]; const base = node.endsWith('.*') ? node.slice(0, -2) : node; return [`${side}:${base}`, ...model.ancestors(base).map(a => `${side}:${a}`)]; },
  });

  const toggle = base => {
    const s = store.get();
    const set = new Set(s.expanded);
    if (set.has(base)) { set.delete(base); for (const d of descendants(base)) set.delete(d); }
    else set.add(base);
    store.set({ expanded: Array.from(set), selected: null, ribbonSel: null });
    announce(`${model.node(base)?.short} ${set.has(base) ? 'développé' : 'replié'}`);
  };
  const descendants = id => { const out = []; const walk = x => { for (const k of model.kidsOf(x)) { out.push(k); walk(k); } }; walk(id); return out; };

  // Toolbar.
  const yearSel = $('#year'), hubSel = $('#hub-level'), opsBox = $('#ops'), basisSel = $('#basis');
  for (const y of years) yearSel.append(h('option', { value: y }, String(y)));
  for (const b of bases) basisSel.append(h('option', { value: b }, BASES[b]?.short || b));
  basisSel.parentElement.hidden = bases.length < 2;
  const levelLabels = basis => (rootOf(basis) === HUB ? T.hubLevels : T.budgetLevels);
  const fillLevels = basis => { clear(hubSel); levelLabels(basis).forEach((label, i) => hubSel.append(h('option', { value: i }, label))); };
  fillLevels(initial.basis);
  // A year without the chosen basis falls back to the national accounts; a basis without the year takes its latest year.
  yearSel.addEventListener('change', async () => { const y = Number(yearSel.value); const basis = data.has(y, store.get().basis) ? store.get().basis : 'sna'; await ensureEdges(y, basis); store.set({ year: y, basis, expanded: basis === store.get().basis ? store.get().expanded : [], hubLevel: basis === store.get().basis ? store.get().hubLevel : 0 }); });
  basisSel.addEventListener('change', async () => { const basis = basisSel.value; const y = data.has(store.get().year, basis) ? store.get().year : yearsOf(basis)[yearsOf(basis).length - 1]; await ensureEdges(y, basis); store.set({ year: y, basis, expanded: [], hubLevel: 0, selected: null, ribbonSel: null }); });
  hubSel.addEventListener('change', () => store.set({ hubLevel: Number(hubSel.value), expanded: store.get().expanded.filter(id => !model.isHub(id)) }));
  opsBox.addEventListener('change', () => store.set({ ops: opsBox.checked }));
  $('#btn-sources').addEventListener('click', () => store.set({ sourcesOpen: !store.get().sourcesOpen }));
  $('#btn-table').addEventListener('click', () => store.set({ tableOpen: !store.get().tableOpen }));
  $('#btn-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toasts.show(T.copied); } catch { toasts.show(location.href); } });
  $('#theme').addEventListener('change', e => { store.set({ theme: e.target.value }); applyTheme(e.target.value); scene.theme(); });
  $('#theme').value = initial.theme;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const s = store.get(); if (s.selected || s.ribbonSel || s.sourcesOpen) store.set({ selected: null, ribbonSel: null, sourcesOpen: false }); else if (s.expanded.length) store.set({ expanded: s.expanded.slice(0, -1) }); }
    if (e.key === '[' || e.key === ']') { const i = years.indexOf(store.get().year); const y = years[i + (e.key === ']' ? 1 : -1)]; if (y) { ensureEdges(y, store.get().basis).then(() => store.set({ year: y })); } }
  });

  const details = detailsPanel($('#details'), { model, prov, onClose: () => store.set({ selected: null, ribbonSel: null }), onExpand: n => toggle(n.base) });
  const sources = sourcesPanel($('#sources'), { prov, onClose: () => store.set({ sourcesOpen: false }) });
  const table = tableView($('#table'), { model });
  const toasts = toast($('#toast'));
  const live = $('#live');
  const chips = $('#chips');
  const renderChips = s => {
    clear(chips);
    for (const id of s.expanded) chips.append(h('button.chip', { type: 'button', onclick: () => toggle(id), 'aria-label': `Replier ${model.node(id)?.short || id}` }, model.node(id)?.short || id, h('span', '×')));
    chips.hidden = !s.expanded.length;
  };
  const announce = text => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };

  // Render on change.
  let lastKey = null;
  store.subscribe((s, changed) => {
    const viewKeys = ['year', 'basis', 'hubLevel', 'expanded', 'ops'];
    const needView = viewKeys.some(k => changed.has(k)) || !view;
    if (needView) {
      if (changed.has('basis')) fillLevels(s.basis);
      view = buildView(model, s, { root: rootOf(s.basis) });
      if (view) {
        scene.show(view, { animate: changed.has('expanded') || changed.has('hubLevel') || changed.has('ops') || changed.has('year') });
        headline(s, view);
        footer(view);
        table.render(view);
        if (s.sourcesOpen) sources.render(view);
      }
    }
    if (changed.has('selected') || changed.has('ribbonSel') || needView) {
      scene.select(s.selected);
      const node = s.selected && view ? view.nodes.find(n => n.id === s.selected) : null;
      details.render(node ? { node } : (s.ribbonSel ? { ribbon: s.ribbonSel } : null), view, s);
      document.body.classList.toggle('has-details', Boolean(node || s.ribbonSel));
    }
    if (changed.has('expanded') || lastKey === null) renderChips(s);
    if (changed.has('sourcesOpen')) { sources.render(s.sourcesOpen ? view : null); document.body.classList.toggle('has-sources', s.sourcesOpen); $('#btn-sources').setAttribute('aria-expanded', String(s.sourcesOpen)); }
    if (changed.has('tableOpen')) { $('#table-wrap').hidden = !s.tableOpen; $('#btn-table').setAttribute('aria-expanded', String(s.tableOpen)); }
    yearSel.value = String(s.year); hubSel.value = String(s.hubLevel); opsBox.checked = s.ops; basisSel.value = s.basis;
    // The address bar.
    const q = encode({ year: s.year, basis: s.basis, hubLevel: s.hubLevel, expanded: s.expanded, ops: s.ops, selected: s.selected, theme: s.theme }, { year: defaultYear, basis: 'sna' });
    if (q !== lastKey) { const push = lastKey !== null && (changed.has('expanded') || changed.has('hubLevel') || changed.has('year')); history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + q); lastKey = q; }
  });
  window.addEventListener('popstate', async () => { const st = decode(location.search, { years, bases, defaults: { ...initial, expanded: [] } }); await ensureEdges(st.year, st.basis); store.set({ year: st.year, basis: st.basis, hubLevel: st.hubLevel, expanded: st.expanded, ops: st.ops, selected: st.selected }); });

  function headline(s, v) {
    const root = rootOf(s.basis);
    const totals = model.node(root).totals[`${s.year}/${s.basis}`] || { in: 0, out: 0 };
    const total = formatNumber(Math.round(totals.in / 1e6));
    const prov = (index.provisional || []).includes(s.year) && s.basis === 'sna' ? ' (comptes provisoires)' : '';
    $('#headline').textContent = root === HUB
      ? `En ${s.year}${prov}, ${total}${NBSP}milliards d’euros sont entrés dans les administrations publiques et presque autant en sont sortis.`
      : `Budget de l’État ${s.year} : ${formatNumber(Math.round(totals.out / 1e6))}${NBSP}milliards d’euros de dépenses du budget général et de prélèvements sur recettes, pour ${formatNumber(Math.round((totals.in - (v.ribbons.find(r => r.from === 'payeurs:FINANCEMENT')?.keur || 0)) / 1e6))}${NBSP}milliards de recettes nettes.`;
    const borrowed = v.ribbons.filter(r => r.from === 'payeurs:FINANCEMENT').reduce((a, r) => a + r.keur, 0) - v.ribbons.filter(r => r.to === 'benef:FINANCEMENT').reduce((a, r) => a + r.keur, 0);
    const note = (basesInfo[s.basis] && basesInfo[s.basis].note) || BASES[s.basis]?.note || '';
    $('#headline-sub').textContent = borrowed > 0 ? `Dont ${formatEuros(borrowed)} ${root === HUB ? 'empruntés pour couvrir le déficit' : 'de solde à financer par l’emprunt'}. ${note}` : note;
  }
  function footer(v) {
    const ids = new Set(v.ribbons.flatMap(r => r.edges.flatMap(e => e.prov || [])));
    const srcs = new Set(Array.from(ids).map(id => prov.records[id]?.source).filter(Boolean));
    const names = Array.from(srcs).map(id => prov.sources[id]).map(sv => `${sv.org} (${sv.title.replace(/^Comptes nationaux annuels, base 2020 – /, '').replace(/\(tableaux.*$/, '').trim()})`);
    clear($('#footer-sources')).append(T.sourcesFooter(names.join(' ; ')), ` — ${ids.size} cellules. `, h('button.linklike', { type: 'button', onclick: () => store.set({ sourcesOpen: true }) }, 'Voir le détail'));
  }

  store.set({ loading: false });
  document.body.classList.remove('is-loading');
  performance.mark && performance.mark('flux-ready');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'clair' || theme === 'sombre') root.dataset.theme = theme === 'clair' ? 'light' : 'dark'; else delete root.dataset.theme;
  try { localStorage.setItem('flux-theme', theme); } catch { /* private window */ }
}

main().catch(error => {
  console.error(error);
  document.body.classList.remove('is-loading');
  const el = document.querySelector('#headline'); if (el) el.textContent = `${T.error} ${error.message}`;
});
