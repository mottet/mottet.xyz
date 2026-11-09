// From the state and the model to what the layout draws: three columns
// (payers, administrations, beneficiaries), the nodes of each in canonical
// order, and one ribbon per pair. A counterpart that both pays and receives
// (households) appears once on each side, keyed by side.

import { HUB, isUnsplit, unsplitOf } from './model.js';
import { T } from './fr.js';

// Canonical order of the counterparts on each side; anything else follows by rank.
const PAYER_ORDER = ['EMPLOYEURS', 'S14', 'CONTRIBUABLES', 'BUDGETS.PUBLICS', 'S11', 'S12', 'S15', 'CONTRIB.LOCAUX', 'PRODUITS', 'PAYEURS', 'CONTRIB.D91', 'S13111', 'PEREQ', 'FINANCEURS.PUBLICS', 'S2', 'S2.EU', 'ACHETEURS', 'PLACEMENTS', 'DIVERS.IN', 'CAPITAL', 'POOL', 'OFGL.POOL', 'IMPUTE', 'FINANCEMENT'];
const BENEF_ORDER = ['PREST', 'CPS.GESTION', 'S14', 'S14.AGENTS', 'CHARGES.SOC', 'FOURNISSEURS', 'S13112', 'CREANCIERS', 'PRODUCTEURS', 'PRODUITS', 'S1313', 'AUTRES.COLL', 'DIVERS.OUT', 'CAPITAL', 'INSTITUTIONS', 'S2.EU', 'S2', 'S12', 'S15', 'S11', 'POOL', 'OFGL.POOL', 'NONRECOUVRE', 'IMPUTE', 'FINANCEMENT', 'CPS.SOLDE'];


/** The sector a node belongs to, for colour. */
export function sectorOf(model, id) {
  const base = isUnsplit(id) ? unsplitOf(id) : id;
  const n = model.node(base);
  if (!n) return 'other';
  if (model.isPool(base)) return 'hub';
  if (n.kind === 'budget') return 'central';
  if (n.kind === 'benefit') return 'households';
  if (base === 'PS' || base.startsWith('PS.')) return base.startsWith('PS.APU') ? 'central' : base.startsWith('PS.SOC') ? 'finance' : base.startsWith('PS.ISBL') ? 'nonprofit' : 'social';
  if (n.kind === 'localtype' || n.kind === 'entity' || base === 'OFGL') return 'local';
  if (model.isHub(base, 'S13')) {
    const top = [base, ...model.ancestors(base)].find(a => ['S1311', 'S1313', 'S1314'].includes(a));
    return top ? { S1311: 'central', S1313: 'local', S1314: 'social' }[top] : 'hub';
  }
  const root = [base, ...model.ancestors(base)].pop();
  return { S14: 'households', S11: 'firms', S12: 'finance', S15: 'nonprofit', S2: 'world', FINANCEMENT: 'debt', IMPUTE: 'imputed', PRODUITS: 'products', PAYEURS: 'products', EMPLOYEURS: 'firms', CONTRIBUABLES: 'products', 'BUDGETS.PUBLICS': 'central', 'CPS.SOLDE': 'debt' }[root] || 'other';
}

/** A display label for a column node (handles "non ventilé" and "non détaillé"). */
export function labelOf(model, id, short = false) {
  if (isUnsplit(id)) { const n = model.node(unsplitOf(id)); return `${n ? n.short : id} : ${T.unsplit}`; }
  const n = model.node(id);
  if (!n) return id;
  return short ? n.short : n.label;
}

export function buildView(model, state, { root = HUB, pooled = false } = {}) {
  // Focus: one node of the hub tree becomes the hub, with its own scale.
  const focus = state.focus && model.node(state.focus) && model.isHub(state.focus, root) ? state.focus : null;
  const hubRoot = focus || root;
  model.root = root;
  const view = { year: state.year, basis: state.basis, root: hubRoot, hub: { level: state.hubLevel, expanded: new Set(state.expanded.filter(id => model.isHub(id, root))) }, side: { ops: state.ops, expanded: new Set(state.expanded.filter(id => !model.isHub(id, root))) } };
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
    const canExpand = Boolean(n) && !isUnsplit(id) && (model.kidsOf(base).some(k => !model.isPool(k) && (side === 'apu' ? model.isHub(k, root) : roleSum(k) > 0)) || (side === 'apu' && Boolean(n.hasFocus)));
    nodes.push({ id: key, node: id, base, column, side, label: labelOf(model, id), short: labelOf(model, id, true), group: parent ? `${side}:${parent}` : undefined, unsplit: isUnsplit(id), synthetic: Boolean(n && n.synthetic), sector: sectorOf(model, id), level: n ? n.level : 0, canExpand, expanded: state.expanded.includes(base) });
    return key;
  };
  // Hub column in canonical (tree) order, with "non ventilé" blocks after their node's children.
  const hubIds = new Set();
  for (const r of roll.ribbons) for (const end of [r.from, r.to]) { const base = isUnsplit(end) ? unsplitOf(end) : end; if (model.isHub(base) && base !== 'POOL') hubIds.add(end); }
  const hubOrdered = [];
  const walk = id => { if (hubIds.has(id)) hubOrdered.push(id); for (const k of model.kidsOf(id)) if (!model.isPool(k)) walk(k); if (hubIds.has(`${id}.*`)) hubOrdered.push(`${id}.*`); };
  walk(hubRoot);
  for (const id of hubOrdered) addNode(id, 1, 'apu');
  const sideNodes = (side, column, order) => {
    const ids = new Set();
    for (const r of roll.ribbons) if (r.side === side) ids.add(side === 'payeurs' ? r.from : r.to);
    for (const r of roll.ribbons) if (r.side === side) { if (model.isPool(r.from)) ids.add(r.from); if (model.isPool(r.to)) ids.add(r.to); }
    // A node the order does not list takes the place of its nearest listed ancestor; inside a tree, the ranks from the top down decide.
    const place = id => { const base = id.replace(/\.(ND|\*)$/, ''); let i = order.indexOf(base); if (i < 0) for (const a of model.ancestors(base)) { i = order.indexOf(a); if (i >= 0) break; } return i < 0 ? 100 : i; };
    const path = id => { const base = id.replace(/\.(ND|\*)$/, ''); return [...model.ancestors(base).reverse(), base].map(x => model.node(x)?.rank ?? 0); };
    const byPath = (a, b) => { const pa = path(a), pb = path(b); for (let i = 0; i < Math.min(pa.length, pb.length); i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return pa.length - pb.length; };
    const sorted = Array.from(ids).sort((a, b) => place(a) - place(b) || byPath(a, b) || (a < b ? -1 : 1));
    for (const id of sorted) addNode(id, column, side);
  };
  sideNodes('payeurs', 0, PAYER_ORDER);
  sideNodes('benef', 2, BENEF_ORDER);
  let ribbons = roll.ribbons.map(r => {
    const from = r.side === 'payeurs' ? `payeurs:${r.from}` : `apu:${r.from}`;
    const to = r.side === 'payeurs' ? `apu:${r.to}` : `benef:${r.to}`;
    return { key: `${from}>${to}`, from, to, keur: r.keur, side: r.side, sector: sectorOf(model, r.side === 'payeurs' ? r.from : r.to), ops: Array.from(r.ops.values()).sort((a, b) => b.keur - a.keur), edges: r.edges };
  });
  let columns = 3;
  // Crowded groups (the communes of a département, the actions of a mission…)
  // keep their largest members and fold the rest into one "Autres (n)" block,
  // which is a sum of the same official figures, never an estimate.
  const MAX_CHILDREN = 40;
  const byGroup = new Map();
  for (const n of nodes) if (n.group && n.side === 'apu' && !n.unsplit && !n.synthetic) { if (!byGroup.has(n.group)) byGroup.set(n.group, []); byGroup.get(n.group).push(n); }
  const folded = new Map();
  for (const [group, members] of byGroup) {
    if (members.length <= MAX_CHILDREN) continue;
    const value = new Map(members.map(m => [m.id, 0]));
    for (const r of ribbons) { if (value.has(r.from)) value.set(r.from, value.get(r.from) + r.keur); if (value.has(r.to)) value.set(r.to, value.get(r.to) + r.keur); }
    const keep = new Set(members.slice().sort((a, b) => value.get(b.id) - value.get(a.id)).slice(0, MAX_CHILDREN - 1).map(m => m.id));
    const parentBase = group.split(':').slice(1).join(':');
    const bucket = `apu:${parentBase}.autres`;
    const rest = members.filter(m => !keep.has(m.id));
    for (const m of rest) folded.set(m.id, bucket);
    const at = nodes.findIndex(n => n.id === rest[rest.length - 1].id);
    nodes.splice(at + 1, 0, { id: bucket, node: `${parentBase}.autres`, base: parentBase, column: 1, side: 'apu', label: `${model.node(parentBase)?.short || parentBase} : autres (${rest.length})`, short: T.others(rest.length), group, synthetic: true, sector: sectorOf(model, parentBase), level: rest[0].level, canExpand: false, members: rest.map(m => m.id) });
  }
  if (folded.size) {
    for (let i = nodes.length - 1; i >= 0; i--) if (folded.has(nodes[i].id)) nodes.splice(i, 1);
    const merged = new Map();
    for (const r of ribbons) {
      const from = folded.get(r.from) || r.from, to = folded.get(r.to) || r.to;
      const k = `${from}>${to}`;
      if (!merged.has(k)) merged.set(k, { ...r, key: k, from, to, keur: 0, ops: [], edges: [], _ops: new Map() });
      const m = merged.get(k); m.keur += r.keur; m.edges = m.edges.concat(r.edges);
      for (const o of r.ops) { const x = m._ops.get(o.op); if (x) x.keur += o.keur; else m._ops.set(o.op, { ...o }); }
    }
    ribbons = Array.from(merged.values()).map(m => { m.ops = Array.from(m._ops.values()).sort((a, b) => b.keur - a.keur); delete m._ops; return m; });
  }
  // A budget: receipts are not earmarked, so when the State is opened into
  // its missions the money first reaches the State as a whole, then each
  // mission gets what it spends (its own official credits), then the
  // beneficiaries. The State's own node sits in a column of its own.
  if (pooled && roll.hubOpen.has(hubRoot)) {
    columns = 4;
    const stateId = `apu:${hubRoot}`;
    const n = model.node(hubRoot);
    nodes.unshift({ id: stateId, node: root, base: root, column: 1, side: 'apu', label: n.label, short: n.short, sector: sectorOf(model, root), level: n.level, canExpand: false, expanded: true, pass: true });
    for (const x of nodes) if (x.column === 1 && x.id !== stateId) x.column = 2; else if (x.column === 2) x.column = 3;
    const out = new Map();
    ribbons = ribbons.filter(r => !(r.from === `apu:${hubRoot}.*`)).map(r => {
      if (r.side === 'payeurs') return { ...r, to: stateId, key: `${r.from}>${stateId}` };
      out.set(r.from, (out.get(r.from) || 0) + r.keur);
      return r;
    });
    const unsplitIn = roll.ribbons.filter(r => r.side === 'payeurs' && r.to === `${hubRoot}.*`);
    // Merge payer ribbons that now share the same ends.
    const merged = new Map();
    for (const r of ribbons) { const k = r.key; if (merged.has(k)) { const m = merged.get(k); m.keur += r.keur; m.edges = m.edges.concat(r.edges); const ops = new Map(m.ops.map(o => [o.op, { ...o }])); for (const o of r.ops) { const x = ops.get(o.op); if (x) x.keur += o.keur; else ops.set(o.op, { ...o }); } m.ops = Array.from(ops.values()).sort((a, b) => b.keur - a.keur); } else merged.set(k, { ...r, ops: r.ops.map(o => ({ ...o })), edges: r.edges.slice() }); }
    ribbons = Array.from(merged.values());
    for (const x of nodes) if (x.column === 2 && !x.unsplit) {
      const keur = out.get(x.id) || 0;
      if (keur > 0) ribbons.push({ key: `${stateId}>${x.id}`, from: stateId, to: x.id, keur, side: 'credits', sector: sectorOf(model, hubRoot), ops: [{ op: 'CREDITS', label: 'Crédits ouverts (somme des dépenses de la ligne)', keur }], edges: ribbons.filter(r => r.from === x.id).flatMap(r => r.edges) });
    }
    nodes.splice(nodes.findIndex(x => x.id === `apu:${hubRoot}.*`) >>> 0, nodes.some(x => x.id === `apu:${hubRoot}.*`) ? 1 : 0);
    void unsplitIn;
  }
  // A pooled basis under focus: the focused line is paid by the budget as a whole.
  if (pooled && focus && !roll.hubOpen.has(hubRoot)) {
    const stateId = `payeurs:${root}`;
    const n = model.node(root);
    const out = ribbons.filter(r => r.side === 'benef').reduce((s, r) => s + r.keur, 0);
    ribbons = ribbons.filter(r => r.side !== 'payeurs');
    nodes.unshift({ id: stateId, node: root, base: root, column: 0, side: 'payeurs', label: `${n.label} (financement non affecté)`, short: `${n.short} : budget général`, sector: sectorOf(model, root), level: n.level, canExpand: false });
    ribbons.push({ key: `${stateId}>apu:${hubRoot}`, from: stateId, to: `apu:${hubRoot}`, keur: out, side: 'payeurs', sector: sectorOf(model, root), ops: [{ op: 'CREDITS', label: 'Crédits ouverts (somme des dépenses de la ligne)', keur: out }], edges: ribbons.filter(r => r.side === 'benef').flatMap(r => r.edges) });
  }
  return { nodes, ribbons, intra: roll.intra, hubVisible: roll.hubVisible, hubOpen: roll.hubOpen, sideOpen: roll.sideOpen, columns, key: selection.key, focus, hubRoot };
}
