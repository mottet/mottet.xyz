// Flux: boot. Loads the index, the nodes and the current year's edges,
// wires the state to the chart and the panels, keeps the address bar in
// step, and registers the service worker.

import { Data } from './js/data.js';
import { Model, HUB } from './js/model.js';
import { buildView } from './js/view.js';
import { Scene, ZOOM_STEP, ZOOM_MAX } from './js/scene.js';
import { createStore } from './js/store.js';
import { encode, decode } from './js/url-state.js';
import { formatEuros, formatNumber, T, BASES, NBSP } from './js/fr.js';
import { h, clear } from './js/ui/h.js';
import { detailsPanel, sourcesPanel, tableView, tooltip, toast } from './js/ui/panels.js';
import { expandFocus } from './js/compact.js';
import { SearchIndex, basisOf } from './js/search.js';

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
  const setFocus = async id => {
    const s = store.get();
    if (id) { if (data.focusFile(s.year, s.basis, id)) await ensureFocus(s.year, s.basis, [id]); const anc = model.ancestors(id); await ensureFocus(s.year, s.basis, anc); }
    store.set({ focus: id, expanded: [], hubLevel: 0, selected: null, ribbonSel: null });
    announce(id ? `${model.node(id)?.short} isolé` : 'Vue d’ensemble');
  };
  applyTheme(initial.theme);

  const [nodes, prov] = await Promise.all([data.nodes(), data.provenance()]);
  const model = new Model(nodes);
  const loadedFocus = new Set();
  const ensureFocus = async (year, basis, ids) => {
    const key = `${year}/${basis}`;
    await Promise.all(ids.filter(id => data.focusFile(year, basis, id) && !loadedFocus.has(`${key}|${id}`)).map(async id => {
      const shard = await data.focus(year, basis, id);
      loadedFocus.add(`${key}|${id}`);
      if (shard) { model.addNodes(shard.nodes || []); model.addEdges(key, expandFocus(shard, { year, basis })); if (shard.prov) Object.assign(prov.records, shard.prov); }
    }));
  };
  const ensureEdges = async (year, basis, expanded = []) => { const key = `${year}/${basis}`; if (!model.hasEdges(key)) { const edges = await data.edges(year, basis); if (edges) model.addEdges(key, edges); } await ensureFocus(year, basis, expanded); };
  await ensureEdges(initial.year, initial.basis, initial.expanded.concat(initial.focus ? [initial.focus] : []));

  // The chart.
  const chartEl = $('#chart');
  let view = null;
  const tip = tooltip($('#tooltip'));
  const scene = new Scene(chartEl, {
    onSelect: n => store.set({ selected: n ? n.id : null, ribbonSel: null }),
    onToggle: n => toggle(n.base),
    onCollapse: base => toggle(base),
    onFocus: n => setFocus(n.base),
    onRibbon: r => store.set({ ribbonSel: r, selected: null }),
    onHover: hv => {
      if (!hv) { tip.hide(); return; }
      if (hv.node) {
        const n = hv.node; const node = scene.nodeAt(n.id); if (!node) { tip.hide(); return; }
        const r = chartEl.getBoundingClientRect();
        const inR = view.ribbons.filter(x => x.to === n.id).reduce((a, x) => a + x.keur, 0), outR = view.ribbons.filter(x => x.from === n.id).reduce((a, x) => a + x.keur, 0);
        tip.show(h('div', h('strong', n.label), inR ? h('div', `${T.in} ${formatEuros(inR)}`) : null, outR ? h('div', `${T.out} ${formatEuros(outR)}`) : null, h('div.hint', n.canExpand ? (n.expanded ? 'Cliquer pour replier, double-clic pour isoler' : 'Cliquer pour développer, double-clic pour isoler') : (n.side === 'apu' ? 'Cliquer pour le détail, double-clic pour isoler' : 'Cliquer pour le détail'))), r.left + node.x + node.width, r.top + node.y);
        return;
      }
      if (hv.ribbon) {
        const r = hv.ribbon.ribbon || hv.ribbon;
        const name = id => view.nodes.find(x => x.id === id)?.short || id;
        tip.show(h('div', h('strong', `${name(r.from)} → ${name(r.to)}`), h('div.amt', formatEuros(r.keur)), h('ul', r.ops.slice(0, 4).map(o => h('li', `${o.label || o.op} : ${formatEuros(o.keur)}`)), r.ops.length > 4 ? h('li', `… et ${r.ops.length - 4} autres`) : null)), hv.x, hv.y);
      } else tip.hide();
    },
    onHoverMove: (x, y) => tip.move(x, y),
    onZoom: z => store.set({ zoom: z }),
    relatives: id => { const [side, node] = [id.split(':')[0], id.split(':').slice(1).join(':')]; const base = node.endsWith('.*') ? node.slice(0, -2) : node; return [`${side}:${base}`, ...model.ancestors(base).map(a => `${side}:${a}`)]; },
  });

  const toggle = async base => {
    const s = store.get();
    const set = new Set(s.expanded);
    if (set.has(base)) { set.delete(base); for (const d of descendants(base)) set.delete(d); }
    else { set.add(base); if (data.focusFile(s.year, s.basis, base)) { document.body.classList.add('is-busy'); await ensureFocus(s.year, s.basis, [base]); document.body.classList.remove('is-busy'); } }
    store.set({ expanded: Array.from(set), selected: null, ribbonSel: null });
    announce(`${model.node(base)?.short} ${set.has(base) ? 'développé' : 'replié'}`);
  };
  const descendants = id => { const out = []; const walk = x => { for (const k of model.kidsOf(x)) { out.push(k); walk(k); } }; walk(id); return out; };

  // Toolbar.
  const yearSel = $('#year'), hubSel = $('#hub-level'), opsBox = $('#ops'), basisSel = $('#basis');
  for (const y of years) yearSel.append(h('option', { value: y }, String(y)));
  for (const b of bases) basisSel.append(h('option', { value: b }, BASES[b]?.short || b));
  basisSel.parentElement.hidden = bases.length < 2;
  const levelLabels = basis => (rootOf(basis) === HUB ? T.hubLevels : (rootOf(basis) === 'OFGL' ? T.localLevels : rootOf(basis) === 'PS' ? T.socialLevels : T.budgetLevels));
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
  // Search: the index comes with the first keystroke; a result opens its basis and isolates the node.
  const searchBox = $('#search'), searchList = $('#search-results');
  let searchIndex = null, searchHits = [], searchAt = -1;
  const openHit = async hit => {
    closeSearch(); searchBox.value = ''; searchBox.blur();
    const basis = basisOf(hit.id), s = store.get();
    const year = basis === s.basis && data.has(s.year, basis) ? s.year : data.has(hit.year, basis) ? hit.year : yearsOf(basis)[yearsOf(basis).length - 1];
    document.body.classList.add('is-busy');
    try {
      await ensureEdges(year, basis);
      store.set({ year, basis, expanded: [], hubLevel: 0, selected: null, ribbonSel: null, focus: null });
      if (hit.focus) await ensureFocus(year, basis, [hit.focus]);
      await setFocus(hit.id === rootOf(basis) ? null : hit.id);
      chartEl.scrollIntoView({ block: 'nearest' });
    } finally { document.body.classList.remove('is-busy'); }
  };
  const closeSearch = () => { searchList.hidden = true; searchBox.setAttribute('aria-expanded', 'false'); searchBox.removeAttribute('aria-activedescendant'); searchAt = -1; };
  const markHit = i => { searchAt = i; Array.from(searchList.children).forEach((li, j) => li.setAttribute('aria-selected', String(i === j))); if (i >= 0) { searchBox.setAttribute('aria-activedescendant', `hit-${i}`); searchList.children[i].scrollIntoView({ block: 'nearest' }); } };
  const runSearch = async () => {
    const q = searchBox.value;
    if (q.trim().length < 2) { closeSearch(); return; }
    if (!searchIndex) { searchIndex = data.search().then(shard => new SearchIndex(shard)); }
    const ix = await searchIndex;
    if (searchBox.value !== q) return;
    searchHits = ix.find(q, 12);
    clear(searchList);
    if (!searchHits.length) searchList.append(h('li.none', { role: 'option', 'aria-disabled': 'true' }, `Rien ne correspond à « ${q.trim()} » parmi les administrations, missions, programmes et collectivités.`));
    searchHits.forEach((hit, i) => searchList.append(h('li', { role: 'option', id: `hit-${i}`, 'aria-selected': 'false', onpointerdown: e => { e.preventDefault(); openHit(hit); } }, h('span.name', hit.label), h('span.amt', formatEuros(hit.keur)), h('span.ctx', [hit.context, BASES[basisOf(hit.id)]?.short, String(hit.year)].filter(Boolean).join(', ')))));
    searchList.hidden = false; searchBox.setAttribute('aria-expanded', 'true'); searchAt = -1;
  };
  searchBox.addEventListener('input', runSearch);
  searchBox.addEventListener('focus', () => { if (searchBox.value.trim().length >= 2) runSearch(); });
  searchBox.addEventListener('blur', () => setTimeout(closeSearch, 120));
  searchBox.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (searchList.hidden || !searchHits.length) return; e.preventDefault(); markHit((searchAt + (e.key === 'ArrowDown' ? 1 : -1) + searchHits.length) % searchHits.length); }
    else if (e.key === 'Enter') { const hit = searchHits[Math.max(0, searchAt)]; if (!searchList.hidden && hit) { e.preventDefault(); openHit(hit); } }
    else if (e.key === 'Escape') { e.stopPropagation(); if (searchList.hidden) searchBox.blur(); else closeSearch(); }
  });
  $('#zoom-in').addEventListener('click', () => scene.zoomBy(ZOOM_STEP));
  $('#zoom-out').addEventListener('click', () => scene.zoomBy(1 / ZOOM_STEP));
  $('#zoom-reset').addEventListener('click', () => scene.setZoom(1));
  document.addEventListener('keydown', e => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '')) {
      if (e.key === '/') { e.preventDefault(); searchBox.focus(); return; }
      if (e.key === '+' || e.key === '=') scene.zoomBy(ZOOM_STEP); else if (e.key === '-') scene.zoomBy(1 / ZOOM_STEP); else if (e.key === '0') scene.setZoom(1);
    }
    if (e.key === 'Escape') { const s = store.get(); if (s.selected || s.ribbonSel || s.sourcesOpen) store.set({ selected: null, ribbonSel: null, sourcesOpen: false }); else if (s.expanded.length) store.set({ expanded: s.expanded.slice(0, -1) }); else if (s.focus) setFocus(null); }
    if (e.key === '[' || e.key === ']') { const i = years.indexOf(store.get().year); const y = years[i + (e.key === ']' ? 1 : -1)]; if (y) { ensureEdges(y, store.get().basis).then(() => store.set({ year: y })); } }
  });

  const details = detailsPanel($('#details'), { model, prov, onClose: () => store.set({ selected: null, ribbonSel: null }), onExpand: n => toggle(n.base), onFocus: n => setFocus(n.base),
    onYear: async y => { await ensureEdges(y, store.get().basis, store.get().expanded); store.set({ year: y }); },
    // The selected node or flow in every year of the basis: the same view rebuilt per year.
    series: async (sel, s) => {
      const ys = yearsOf(s.basis).filter(y => data.has(y, s.basis));
      if (ys.length < 2) return null;
      await Promise.all(ys.map(y => ensureEdges(y, s.basis, s.expanded)));
      const sum = (list, f) => list.filter(f).reduce((a, r) => a + r.keur, 0);
      return ys.map(y => {
        const v = y === s.year ? view : buildView(model, { ...s, year: y }, { root: rootOf(s.basis), pooled: Boolean(basesInfo[s.basis] && basesInfo[s.basis].pooled) });
        if (!v) return { year: y, in: 0, out: 0 };
        if (sel.node) return { year: y, in: sum(v.ribbons, r => r.to === sel.node.id), out: sum(v.ribbons, r => r.from === sel.node.id) };
        const key = (sel.ribbon.ribbon || sel.ribbon).key;
        return { year: y, in: sum(v.ribbons, r => r.key === key), out: 0 };
      });
    } });
  const sources = sourcesPanel($('#sources'), { prov, onClose: () => store.set({ sourcesOpen: false }) });
  const table = tableView($('#table'), { model });
  const toasts = toast($('#toast'));
  const live = $('#live');
  const chips = $('#chips');
  const renderChips = s => {
    clear(chips);
    if (s.focus) {
      const path = [...model.ancestors(s.focus).reverse().filter(a => model.isHub(a, rootOf(s.basis))), s.focus];
      chips.append(h('button.chip.focus', { type: 'button', onclick: () => setFocus(null), 'aria-label': 'Revenir à la vue d’ensemble' }, 'Vue d’ensemble'));
      for (const id of path) chips.append(h('button.chip.focus', { type: 'button', onclick: () => setFocus(id === s.focus ? null : id), 'aria-label': `Isoler ${model.node(id)?.short || id}` }, model.node(id)?.short || id, id === s.focus ? h('span', '×') : null));
    }
    for (const id of s.expanded) chips.append(h('button.chip', { type: 'button', onclick: () => toggle(id), 'aria-label': `Replier ${model.node(id)?.short || id}` }, model.node(id)?.short || id, h('span', '×')));
    chips.hidden = !s.expanded.length && !s.focus;
  };
  const announce = text => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };

  // Render on change.
  let lastKey = null;
  store.subscribe((s, changed) => {
    const viewKeys = ['year', 'basis', 'hubLevel', 'expanded', 'ops', 'focus'];
    const needView = viewKeys.some(k => changed.has(k)) || !view;
    if (needView) {
      if (changed.has('basis')) fillLevels(s.basis);
      view = buildView(model, s, { root: rootOf(s.basis), pooled: Boolean(basesInfo[s.basis] && basesInfo[s.basis].pooled) });
      if (view) view.prov = prov;
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
    if (changed.has('expanded') || changed.has('focus') || lastKey === null) renderChips(s);
    if (changed.has('sourcesOpen')) { sources.render(s.sourcesOpen ? view : null); document.body.classList.toggle('has-sources', s.sourcesOpen); $('#btn-sources').setAttribute('aria-expanded', String(s.sourcesOpen)); }
    if (changed.has('zoom') || lastKey === null) {
      scene.setZoom(s.zoom || 1, undefined, { quiet: true });
      $('#zoom-level').textContent = `${formatNumber(Math.round((s.zoom || 1) * 100))}${NBSP}%`;
      $('#zoom-out').disabled = (s.zoom || 1) <= 1; $('#zoom-in').disabled = (s.zoom || 1) >= ZOOM_MAX;
    }
    if (changed.has('tableOpen')) { $('#table-wrap').hidden = !s.tableOpen; $('#btn-table').setAttribute('aria-expanded', String(s.tableOpen)); }
    yearSel.value = String(s.year); hubSel.value = String(s.hubLevel); opsBox.checked = s.ops; basisSel.value = s.basis;
    // The address bar.
    const q = encode({ year: s.year, basis: s.basis, hubLevel: s.hubLevel, expanded: s.expanded, ops: s.ops, selected: s.selected, theme: s.theme, focus: s.focus, zoom: s.zoom }, { year: defaultYear, basis: 'sna' });
    if (q !== lastKey) { const push = lastKey !== null && (changed.has('expanded') || changed.has('hubLevel') || changed.has('year') || changed.has('focus')); history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + q); lastKey = q; }
  });
  window.addEventListener('popstate', async () => { const st = decode(location.search, { years, bases, defaults: { ...initial, expanded: [] } }); await ensureEdges(st.year, st.basis, st.expanded.concat(st.focus ? [st.focus, ...model.ancestors(st.focus)] : [])); store.set({ year: st.year, basis: st.basis, hubLevel: st.hubLevel, expanded: st.expanded, ops: st.ops, selected: st.selected, focus: st.focus, zoom: st.zoom }); });

  function headline(s, v) {
    const root = rootOf(s.basis);
    $('#head-hub').textContent = model.node(v.focus || root)?.short || '';
    if (v.focus) {
      const n = model.node(v.focus);
      const inR = v.ribbons.filter(r => r.side === 'payeurs').reduce((a, r) => a + r.keur, 0), outR = v.ribbons.filter(r => r.side === 'benef').reduce((a, r) => a + r.keur, 0);
      $('#headline').textContent = `${n.label}. En ${s.year}, ${formatEuros(inR)} reçus et ${formatEuros(outR)} versés.`;
      $('#headline-sub').textContent = `${(basesInfo[s.basis] && basesInfo[s.basis].note) || BASES[s.basis]?.note || ''} Échap ou « Vue d’ensemble » pour revenir.`;
      return;
    }
    const totals = model.node(root).totals[`${s.year}/${s.basis}`] || { in: 0, out: 0 };
    const total = formatNumber(Math.round(totals.in / 1e6));
    const prov = (index.provisional || []).includes(s.year) && s.basis === 'sna' ? ' (comptes provisoires)' : '';
    $('#headline').textContent = root === HUB
      ? `En ${s.year}${prov}, ${total}${NBSP}milliards d’euros sont entrés dans les administrations publiques et presque autant en sont sortis.`
      : root === 'PS' ? `Protection sociale ${s.year} : ${formatNumber(Math.round((v.ribbons.filter(r => r.side === 'benef' && r.to.startsWith('benef:PREST')).reduce((a, r) => a + r.keur, 0)) / 1e6))}${NBSP}milliards d’euros de prestations versées aux ménages par l’ensemble des régimes, publics et privés.`
      : root === 'OFGL' ? `Collectivités locales ${s.year} : ${formatNumber(Math.round(totals.out / 1e6))}${NBSP}milliards d’euros de dépenses réelles des communes, intercommunalités, départements et régions, pour ${formatNumber(Math.round((totals.in - (v.ribbons.find(r => r.from === 'payeurs:FINANCEMENT' && r.ops.some(o => o.op === 'FDR'))?.keur || 0)) / 1e6))}${NBSP}milliards de recettes.`
      : `Budget de l’État ${s.year} : ${formatNumber(Math.round(totals.out / 1e6))}${NBSP}milliards d’euros de dépenses du budget général et de prélèvements sur recettes, pour ${formatNumber(Math.round((totals.in - (v.ribbons.find(r => r.from === 'payeurs:FINANCEMENT')?.keur || 0)) / 1e6))}${NBSP}milliards de recettes nettes.`;
    const borrowed = v.ribbons.filter(r => r.from === 'payeurs:FINANCEMENT').reduce((a, r) => a + r.keur, 0) - v.ribbons.filter(r => r.to === 'benef:FINANCEMENT').reduce((a, r) => a + r.keur, 0);
    const note = (basesInfo[s.basis] && basesInfo[s.basis].note) || BASES[s.basis]?.note || '';
    $('#headline-sub').textContent = borrowed > 0 && root !== 'OFGL' && root !== 'PS' ? `Dont ${formatEuros(borrowed)} ${root === HUB ? 'empruntés pour couvrir le déficit' : 'de solde à financer par l’emprunt'}. ${note}` : note;
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
