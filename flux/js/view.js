// From the state and the model to what the layout draws: three columns
// (payers, administrations, beneficiaries), the nodes of each in canonical
// order, and one ribbon per pair. A counterpart that both pays and receives
// (households) appears once on each side, keyed by side.

import { HUB, isUnsplit, unsplitOf } from './model.js';
import { T } from './fr.js';

// Canonical order of the counterparts on each side; anything else follows by rank.
const PAYER_ORDER = ['S14', 'S11', 'S12', 'S15', 'PRODUITS', 'PAYEURS', 'CONTRIB.D91', 'S2', 'S2.EU', 'ACHETEURS', 'PLACEMENTS', 'DIVERS.IN', 'CAPITAL', 'POOL', 'IMPUTE', 'FINANCEMENT'];
const BENEF_ORDER = ['S14', 'S14.AGENTS', 'FOURNISSEURS', 'CREANCIERS', 'PRODUCTEURS', 'PRODUITS', 'DIVERS.OUT', 'CAPITAL', 'S2.EU', 'S2', 'S12', 'S15', 'S11', 'POOL', 'NONRECOUVRE', 'IMPUTE', 'FINANCEMENT'];

const orderIndex = (list, id) => { const base = id.replace(/\.(ND|\*)$/, ''); const i = list.indexOf(base); return i < 0 ? 100 : i; };

/** The sector a node belongs to, for colour. */
export function sectorOf(model, id) {
  const base = isUnsplit(id) ? unsplitOf(id) : id;
  const n = model.node(base);
  if (!n) return 'other';
  if (base === 'POOL') return 'hub';
  if (model.isHub(base)) {
    const top = [base, ...model.ancestors(base)].find(a => ['S1311', 'S1313', 'S1314'].includes(a));
    return top ? { S1311: 'central', S1313: 'local', S1314: 'social' }[top] : 'hub';
  }
  const root = [base, ...model.ancestors(base)].pop();
  return { S14: 'households', S11: 'firms', S12: 'finance', S15: 'nonprofit', S2: 'world', FINANCEMENT: 'debt', IMPUTE: 'imputed', PRODUITS: 'products', PAYEURS: 'products' }[root] || 'other';
}

/** A display label for a column node (handles "non ventilé" and "non détaillé"). */
export function labelOf(model, id, short = false) {
  if (isUnsplit(id)) { const n = model.node(unsplitOf(id)); return `${n ? n.short : id} : ${T.unsplit}`; }
  const n = model.node(id);
  if (!n) return id;
  return short ? n.short : n.label;
}

export function buildView(model, state) {
  const view = { year: state.year, basis: state.basis, hub: { level: state.hubLevel, expanded: new Set(state.expanded.filter(id => model.isHub(id))) }, side: { ops: state.ops, expanded: new Set(state.expanded.filter(id => !model.isHub(id))) } };
  const selection = model.select(view);
  if (!selection) return null;
  const roll = model.rollup(selection, { sideExpanded: view.side.expanded });
  const nodes = [];
  const seen = new Set();
  const addNode = (id, column, side) => {
    const key = `${side}:${id}`;
    if (seen.has(key)) return key;
    seen.add(key);
    const base = isUnsplit(id) ? unsplitOf(id) : id;
    const n = model.node(base);
    const parent = isUnsplit(id) ? base : (n && n.parent && n.parent !== HUB && roll.hubOpen.has(n.parent) ? n.parent : (n && n.parent && roll.sideOpen.has(n.parent) ? n.parent : null));
    const key2 = `${state.year}/${state.basis}`;
    const roleSum = k => { const t = model.node(k)?.totals?.[key2]; return t ? (side === 'payeurs' ? t.out : (side === 'benef' ? t.in : t.in + t.out)) : 0; };
    const canExpand = Boolean(n) && !isUnsplit(id) && model.kidsOf(base).some(k => k !== 'POOL' && (side === 'apu' || roleSum(k) > 0));
    nodes.push({ id: key, node: id, base, column, side, label: labelOf(model, id), short: labelOf(model, id, true), group: parent ? `${side}:${parent}` : undefined, unsplit: isUnsplit(id), synthetic: Boolean(n && n.synthetic), sector: sectorOf(model, id), level: n ? n.level : 0, canExpand, expanded: state.expanded.includes(base) });
    return key;
  };
  // Hub column in canonical (tree) order, with "non ventilé" blocks after their node's children.
  const hubIds = new Set();
  for (const r of roll.ribbons) for (const end of [r.from, r.to]) { const base = isUnsplit(end) ? unsplitOf(end) : end; if (model.isHub(base) && base !== 'POOL') hubIds.add(end); }
  const hubOrdered = [];
  const walk = id => { if (hubIds.has(id)) hubOrdered.push(id); for (const k of model.kidsOf(id)) if (k !== 'POOL') walk(k); if (hubIds.has(`${id}.*`)) hubOrdered.push(`${id}.*`); };
  walk(HUB);
  for (const id of hubOrdered) addNode(id, 1, 'apu');
  const sideNodes = (side, column, order) => {
    const ids = new Set();
    for (const r of roll.ribbons) if (r.side === side) ids.add(side === 'payeurs' ? r.from : r.to);
    for (const r of roll.ribbons) if (r.side === side && (r.from === 'POOL' || r.to === 'POOL')) ids.add('POOL');
    const sorted = Array.from(ids).sort((a, b) => orderIndex(order, a) - orderIndex(order, b) || (model.node(a)?.rank ?? 0) - (model.node(b)?.rank ?? 0) || (a < b ? -1 : 1));
    for (const id of sorted) addNode(id, column, side);
  };
  sideNodes('payeurs', 0, PAYER_ORDER);
  sideNodes('benef', 2, BENEF_ORDER);
  const ribbons = roll.ribbons.map(r => {
    const from = r.side === 'payeurs' ? `payeurs:${r.from}` : `apu:${r.from}`;
    const to = r.side === 'payeurs' ? `apu:${r.to}` : `benef:${r.to}`;
    return { key: `${from}>${to}`, from, to, keur: r.keur, side: r.side, sector: sectorOf(model, r.side === 'payeurs' ? r.from : r.to), ops: Array.from(r.ops.values()).sort((a, b) => b.keur - a.keur), edges: r.edges };
  });
  return { nodes, ribbons, intra: roll.intra, hubVisible: roll.hubVisible, hubOpen: roll.hubOpen, sideOpen: roll.sideOpen, columns: 3, key: selection.key };
}
