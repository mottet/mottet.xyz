// The panels beside the chart: details of a node or ribbon, the sources
// behind what is on screen, the table of visible flows, the tooltip, the
// toast. Plain DOM, one function per panel, each returning a render(…).

import { h, clear, append } from './h.js';
import { formatEuros, formatShare, formatDate, T } from '../fr.js';
import { isUnsplit, unsplitOf } from '../model.js';

const LICENCES = { LO2: 'Licence Ouverte 2.0', CCBY4: 'CC BY 4.0', PARL: 'document parlementaire' };

function sourceLine(prov, id) {
  const r = prov.records[id]; if (!r) return null;
  const s = prov.sources[r.source];
  const loc = r.locator || {};
  const where = [loc.table && `tableau ${String(loc.table).replace(/^(\d)(\d{3})$/, '$1.$2')}`, loc.sheet && `feuille ${loc.sheet}`, loc.cell && `cellule ${loc.cell}`, loc.row && `ligne « ${loc.row} »`, loc.op && `opération ${loc.op} (${loc.side === 'emplois' ? 'emplois' : 'ressources'} ${loc.sector})`, loc.na_item && `${loc.sector} ${loc.na_item} ${loc.time}`, loc.file && loc.file, loc.page && `page ${loc.page}`].filter(Boolean).join(', ');
  return h('li.source', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, `${s.org}, ${s.title}`), h('span.where', ` — ${where}`), h('span.meta', `${T.retrieved} ${formatDate(r.retrieved)}${s.licence ? `, ${LICENCES[s.licence] || s.licence}` : ''}`));
}

/** Details of a node or a ribbon, with its official sources. */
export function detailsPanel(el, { model, prov, onClose, onExpand, onFocus }) {
  return {
    render(sel, view, state) {
      clear(el);
      if (!sel) { el.hidden = true; return; }
      el.hidden = false;
      const head = h('header', h('button.close', { type: 'button', 'aria-label': T.close, onclick: onClose }, '×'));
      if (sel.node) {
        const n = sel.node;
        const base = n.base;
        const node = model.node(base);
        const inR = view.ribbons.filter(r => r.to === n.id), outR = view.ribbons.filter(r => r.from === n.id);
        const sumIn = inR.reduce((s, r) => s + r.keur, 0), sumOut = outR.reduce((s, r) => s + r.keur, 0);
        append(el, [head, h('h2', n.label), node && node.notes ? h('p.note', node.notes.join(' ')) : null,
          n.unsplit ? h('p.note', `Part que la source ne ventile pas entre les composantes de ${model.node(unsplitOf(n.node))?.short}.`) : null,
          h('dl.figures',
            sumIn ? [h('dt', T.in), h('dd', formatEuros(sumIn))] : null,
            sumOut ? [h('dt', T.out), h('dd', formatEuros(sumOut))] : null,
            sumIn && sumOut ? [h('dt', T.balance), h('dd', formatEuros(sumIn - sumOut))] : null),
          n.canExpand ? h('button.action', { type: 'button', onclick: () => onExpand(n) }, state.expanded.includes(base) ? T.collapse : T.expand) : null,
          flowsList('Ce qu’il reçoit', inR, model, 'from'), flowsList('Ce qu’il verse', outR, model, 'to'),
          intraList(model, view, base),
          sourcesList(prov, new Set(inR.concat(outR).concat(intraOf(model, view, base)).flatMap(r => (r.edges || [r.edge]).flatMap(e => e.prov || []))))]);
      } else if (sel.ribbon) {
        const r = sel.ribbon.ribbon || sel.ribbon;
        const from = view.nodes.find(x => x.id === r.from), to = view.nodes.find(x => x.id === r.to);
        append(el, [head, h('h2', `${from ? from.short : r.from} → ${to ? to.short : r.to}`), h('p.big', formatEuros(r.keur)),
          h('ul.ops', (r.ops || []).map(o => h('li', h('span.op', o.label || o.op), h('span.amt', formatEuros(o.keur))))),
          notesOf(r.edges || []),
          sourcesList(prov, new Set((r.edges || []).flatMap(e => e.prov || [])))]);
      }
    },
  };
}

// Transfers between administrations touching a hub node (not consolidated, so listed apart).
function intraOf(model, view, base) {
  return (view.intra || []).filter(p => p.edge.from === base || p.edge.to === base);
}
function intraList(model, view, base) {
  const items = intraOf(model, view, base);
  if (!items.length) return null;
  const line = p => { const e = p.edge; const other = e.from === base ? e.to : e.from; const n = model.node(other); return h('li', h('span.name', `${e.from === base ? 'Vers' : 'De'} ${n ? n.short.toLowerCase() : other} (${e.opLabel})`), h('span.amt', formatEuros(e.keur))); };
  return h('section.flows', h('h3', T.intra), h('p.note', 'Hors du total consolidé : versés ou reçus d’autres administrations publiques.'), h('ul', items.sort((a, b) => b.edge.keur - a.edge.keur).map(line)));
}

function flowsList(title, ribbons, model, end) {
  if (!ribbons.length) return null;
  const total = ribbons.reduce((s, r) => s + r.keur, 0);
  return h('section.flows', h('h3', title), h('ul', ribbons.slice().sort((a, b) => b.keur - a.keur).map(r => {
    const other = r[end];
    const id = other.split(':').slice(1).join(':');
    const label = isUnsplit(id) ? `${model.node(unsplitOf(id))?.short} : ${T.unsplit}` : (model.node(id)?.short || id);
    return h('li', h('span.name', label), h('span.amt', formatEuros(r.keur)), h('span.share', formatShare(r.keur / total)));
  })));
}

function notesOf(edges) {
  const notes = new Map();
  for (const e of edges) {
    if (e.note) notes.set(e.note, true);
    if (e.flags && e.flags.includes('imputed')) notes.set(`${e.opLabel} : ${T.imputed}.`, true);
    if (e.consolidated) notes.set(`Chiffre consolidé : ${formatEuros(e.consolidated)} de flux entre administrations sont retirés du total.`, true);
    if (e.derivation === 'residual') notes.set('Reste non détaillé par la source.', true);
    if (e.derivation === 'widened') notes.set('La source ne nomme pas de contrepartie plus précise.', true);
  }
  if (!notes.size) return null;
  return h('ul.notes', Array.from(notes.keys()).map(n => h('li', n)));
}

export function sourcesList(prov, ids) {
  const items = Array.from(ids).map(id => sourceLine(prov, id)).filter(Boolean);
  if (!items.length) return null;
  // Group identical sources: show one line per (source, table/file) with the cells collapsed.
  const byKey = new Map();
  for (const id of ids) {
    const r = prov.records[id]; if (!r) continue;
    const s = prov.sources[r.source]; const loc = r.locator || {};
    const key = `${r.source}|${loc.table || loc.file || loc.na_item ? (loc.table || loc.file || 'eurostat') : ''}`;
    if (!byKey.has(key)) byKey.set(key, { s, r, cells: [] });
    byKey.get(key).cells.push(loc.cell || (loc.na_item ? `${loc.sector} ${loc.na_item} ${loc.time}` : '') || (loc.op ? `${loc.op} ${loc.sector}` : ''));
  }
  return h('section.sources', h('h3', T.sources), h('ul', Array.from(byKey.values()).map(({ s, r, cells }) => {
    const loc = r.locator || {};
    const what = loc.table ? `tableau ${String(loc.table).replace(/^(\d)(\d{3})$/, '$1.$2')}` : (loc.file ? loc.file : (loc.na_item ? 'gov_10a_main' : ''));
    const list = cells.filter(Boolean);
    return h('li.source', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title), h('span.where', [what, list.length ? (list.length > 6 ? `${list.length} cellules` : list.join(', ')) : ''].filter(Boolean).join(' — ')), h('span.meta', `${s.org}, ${T.retrieved} ${formatDate(r.retrieved)}, ${LICENCES[s.licence] || s.licence}`));
  })));
}

/** The sources behind everything on screen. */
export function sourcesPanel(el, { prov, onClose }) {
  return {
    render(view) {
      clear(el);
      if (!view) { el.hidden = true; return; }
      el.hidden = false;
      const ids = new Set(view.ribbons.flatMap(r => r.edges.flatMap(e => e.prov || [])));
      append(el, [h('header', h('button.close', { type: 'button', 'aria-label': T.close, onclick: onClose }, '×')), h('h2', 'Sources des chiffres affichés'), h('p.note', 'Chaque flux à l’écran est la somme de cellules de ces tableaux officiels ; aucun chiffre n’est estimé.'), sourcesList(prov, ids)]);
    },
  };
}

/** The accessible table of the visible flows. */
export function tableView(el, { model }) {
  return {
    render(view) {
      clear(el);
      if (!view) return;
      const name = id => { const n = view.nodes.find(x => x.id === id); return n ? n.short : id; };
      const total = view.ribbons.reduce((s, r) => s + r.keur, 0);
      el.append(h('table', h('thead', h('tr', h('th', T.from), h('th', T.to), h('th', T.op), h('th.num', T.amount), h('th.num', T.share))),
        h('tbody', view.ribbons.slice().sort((a, b) => b.keur - a.keur).map(r => h('tr', h('td', name(r.from)), h('td', name(r.to)), h('td', r.ops.map(o => o.label || o.op).join(' ; ')), h('td.num', formatEuros(r.keur)), h('td.num', formatShare(r.keur / total)))))));
    },
  };
}

/** The tooltip that follows the pointer. */
export function tooltip(el) {
  return {
    show(html, x, y) { clear(el); el.append(html); el.hidden = false; this.move(x, y); },
    move(x, y) { const w = el.offsetWidth, hgt = el.offsetHeight; const vw = window.innerWidth, vh = window.innerHeight; el.style.left = `${Math.min(x + 14, vw - w - 8)}px`; el.style.top = `${y + 18 + hgt > vh ? y - hgt - 8 : y + 18}px`; },
    hide() { el.hidden = true; },
  };
}

export function toast(el) {
  let timer = 0;
  return { show(text) { el.textContent = text; el.hidden = false; clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, 2200); } };
}
