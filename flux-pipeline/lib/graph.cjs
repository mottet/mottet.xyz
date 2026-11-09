'use strict';

// The flow graph: nodes in trees (sectors, budget lines, branches, local
// authorities, beneficiary classes) and edges carrying one official figure
// each. An edge can be refined by child edges that split one of its ends
// (`split: 'to'` or 'from') or its operation (`split: 'op'`); the children
// of a split always sum to the parent, a "non détaillé" residual edge to a
// `<node>.ND` child being added by finalize() when the source gives less
// than the total. Nothing is ever allocated: a counterpart the source does
// not name is a widened node, and a figure the source does not give is a
// residual. Every edge names its provenance records.
const fs = require('node:fs');
const path = require('node:path');

const KINDS = new Set(['sector', 'budget', 'branch', 'function', 'tax', 'benefit', 'localtype', 'entity', 'class']);
const BASES = new Set(['sna', 'budget-plf', 'budget-lfi', 'budget-exec', 'local-ofgl', 'local-m57', 'cps', 'plfss']);
const DERIVATIONS = new Set(['direct', 'sum', 'single-counterpart', 'widened', 'residual', 'bridge']);
const SPLITS = new Set(['from', 'to', 'op']);
const ND = 'ND';

const sortKeys = v => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  return v;
};
const stable = v => JSON.stringify(sortKeys(v));

class Graph {
  constructor({ registry, tolerance = { share: 0.001, keur: 50000 } } = {}) {
    this.registry = registry;
    this.tolerance = tolerance;
    this.nodes = new Map();
    this.edges = new Map();
    this.children = new Map();
    this.log = [];
  }

  node(def) {
    const n = { ...def };
    if (!n.id) throw new Error('node without id');
    if (this.nodes.has(n.id)) return this.nodes.get(n.id);
    if (!KINDS.has(n.kind)) throw new Error(`node ${n.id}: kind ${n.kind}`);
    if (n.parent && !this.nodes.has(n.parent)) throw new Error(`node ${n.id}: parent ${n.parent} unknown`);
    n.level = n.parent ? this.nodes.get(n.parent).level + 1 : 0;
    if (!n.label) throw new Error(`node ${n.id}: label`);
    n.short = n.short || n.label;
    n.role = n.role || 'both';
    n.rank = n.rank === undefined ? (this.children.get(n.parent || '') || []).length : n.rank;
    n.prov = n.prov || [];
    this.nodes.set(n.id, n);
    const key = n.parent || '';
    if (!this.children.has(key)) this.children.set(key, []);
    this.children.get(key).push(n.id);
    return n;
  }

  // A "non détaillé" child of a node, made on first use.
  nd(parentId) {
    const id = `${parentId}.${ND}`;
    if (!this.nodes.has(id)) {
      const p = this.nodes.get(parentId);
      this.node({ id, parent: parentId, kind: 'class', label: `${p.short} : non détaillé`, short: 'Non détaillé', role: p.role, rank: 9999, synthetic: true });
    }
    return id;
  }

  edge(def) {
    const e = { flags: [], prov: [], ...def };
    for (const k of ['id', 'from', 'to', 'op', 'year', 'basis', 'derivation']) if (e[k] === undefined || e[k] === null) throw new Error(`edge ${e.id || '?'}: ${k} missing`);
    if (this.edges.has(e.id)) throw new Error(`edge ${e.id} twice`);
    for (const end of ['from', 'to']) if (!this.nodes.has(e[end])) throw new Error(`edge ${e.id}: ${end} ${e[end]} unknown`);
    if (!Number.isInteger(e.keur)) throw new Error(`edge ${e.id}: keur ${e.keur}`);
    if (!BASES.has(e.basis)) throw new Error(`edge ${e.id}: basis ${e.basis}`);
    if (!DERIVATIONS.has(e.derivation)) throw new Error(`edge ${e.id}: derivation ${e.derivation}`);
    if (e.keur < 0) { e.keur = -e.keur; [e.from, e.to] = [e.to, e.from]; e.flags.push('sign-flipped'); }
    if (e.parent !== undefined) {
      const parent = this.edges.get(e.parent);
      if (!parent) throw new Error(`edge ${e.id}: parent ${e.parent} unknown`);
      if (!SPLITS.has(e.split)) throw new Error(`edge ${e.id}: split ${e.split}`);
      // A child runs the parent's way (+1) or, when a sub-sector's balance has
      // the other sign, against it (-1); the signed children sum to the
      // parent. The parent itself may have been flipped, so the test is on
      // the counterpart end: the child and the parent run the same way when
      // that end is `to` for both or `from` for both.
      // Found by containment, whatever the split is called and whether either
      // edge was flipped: an end of the child under the same end of the parent.
      if (e.split === 'op') e.sign = 1;
      else if (this.within(e.from, parent.from) || this.within(e.to, parent.to)) e.sign = 1;
      else if (this.within(e.from, parent.to) || this.within(e.to, parent.from)) e.sign = -1;
      else e.sign = 1;
    }
    if (!e.prov.length && e.derivation !== 'residual') throw new Error(`edge ${e.id}: no provenance`);
    for (const p of e.prov) if (this.registry && !this.registry.records.has(p)) throw new Error(`edge ${e.id}: provenance ${p} unknown`);
    this.edges.set(e.id, e);
    return e;
  }

  ancestors(id) { const out = []; let n = this.nodes.get(id); while (n && n.parent) { out.push(n.parent); n = this.nodes.get(n.parent); } return out; }
  within(id, ancestor) { return id === ancestor || this.ancestors(id).includes(ancestor); }
  kids(edgeId, split) { return Array.from(this.edges.values()).filter(e => e.parent === edgeId && (!split || e.split === split)); }

  // Residuals: for every split, children must sum to the parent. A shortfall
  // within tolerance or above becomes a residual edge to the "non détaillé"
  // child of the split node (or the same ends for an op split); an excess
  // beyond tolerance flags the parent `over-coverage` and the children keep
  // their own figures side by side.
  finalize() {
    const byParent = new Map();
    for (const e of this.edges.values()) if (e.parent) {
      const key = `${e.parent}|${e.split}`;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(e);
    }
    for (const [key, kids] of byParent) {
      const cut = key.lastIndexOf('|');
      const parentId = key.slice(0, cut), split = key.slice(cut + 1);
      const parent = this.edges.get(parentId);
      const sum = kids.reduce((s, e) => s + (e.sign || 1) * e.keur, 0);
      // `consolidated`: what the unconsolidated sub-sector figures hold of flows between administrations.
      const gap = parent.keur + (parent.consolidated || 0) - sum;
      const tol = Math.max(this.tolerance.keur, Math.round(parent.keur * this.tolerance.share));
      if (gap === 0) continue;
      // Each child is rounded to the thousand euros on its own: a gap of that order is rounding, not a missing part.
      if (Math.abs(gap) <= kids.length) { parent.rounding = gap; continue; }
      if (gap < 0) {
        if (-gap > tol) { parent.flags.push('over-coverage'); this.log.push(`over-coverage ${parentId}/${split}: children ${sum} > parent ${parent.keur}`); }
        else this.log.push(`children of ${parentId}/${split} exceed the parent by ${-gap} k€ (within tolerance)`);
        continue;
      }
      const id = `${parentId}~${split}~nd`;
      const e = { id, op: parent.op, opLabel: parent.opLabel, year: parent.year, basis: parent.basis, keur: gap, parent: parentId, split, derivation: 'residual', prov: [], flags: ['residual'], from: parent.from, to: parent.to };
      if (split === 'to') e.to = this.nd(parent.to);
      else if (split === 'from') e.from = this.nd(parent.from);
      else { e.op = `${parent.op}.autres`; e.opLabel = `${parent.opLabel} : autres`; }
      e.note = `Reste non détaillé par la source : ${parent.keur} − ${sum} k€.`;
      this.edges.set(id, e);
    }
  }

  // Totals of a node as receiver/payer per year and basis, following the
  // splits down from the root edges so a node's total equals the sum of the
  // ribbons the site will draw for it at any level.
  totals() {
    // Alternative roots (`alt`: the same flow seen from another source) are left out of the totals.
    const roots = Array.from(this.edges.values()).filter(e => !e.parent && !e.alt);
    const kidsOf = new Map();
    for (const e of this.edges.values()) if (e.parent) { const k = `${e.parent}|${e.split}`; if (!kidsOf.has(k)) kidsOf.set(k, []); kidsOf.get(k).push(e); }
    const totals = new Map();
    const add = (node, key, side, v) => {
      if (!totals.has(node)) totals.set(node, {});
      const t = totals.get(node);
      if (!t[key]) t[key] = { in: 0, out: 0 };
      t[key][side] += v;
    };
    // `logical` is the side as the root sees it (which split holds the finer
    // edges); `side` is the way this edge actually runs, flipped by a child
    // with the other sign.
    const walk = (e, side) => {
      const logical = side;
      const end = side === 'in' ? e.to : e.from;
      const key = `${e.year}/${e.basis}`;
      // The edge counts for `end` and every ancestor; finer edges count for
      // the finer nodes. Flows between administrations (`intra`) exist at
      // every level with that level's own figure, so they count for their
      // own end only.
      add(end, key, side, e.keur);
      // …but never for an ancestor the other end sits under (a flow into the
      // pool of transfers between administrations is not a receipt of S13).
      const other = side === 'in' ? e.from : e.to;
      const shared = new Set([other, ...this.ancestors(other)]);
      if (!e.flags.includes('intra')) for (const a of this.ancestors(end)) if (!shared.has(a)) add(a, key, side, e.keur);
      for (const [k, kside] of hubKids(e, end, other)) walkFiner(k, logical, kside);
    };
    // Below a split, only the finer node (not its ancestors, already counted) takes the amount.
    const walkFiner = (e, logical, side) => {
      const end = side === 'in' ? e.to : e.from;
      const key = `${e.year}/${e.basis}`;
      const parent = this.edges.get(e.parent);
      const parentHub = [parent.from, parent.to].find(x => this.within(end, x)) || null;
      add(end, key, side, e.keur);
      for (const a of this.ancestors(end)) { if (a === parentHub) break; add(a, key, side, e.keur); }
      for (const [k, kside] of hubKids(e, end, side === 'in' ? e.from : e.to)) walkFiner(k, logical, kside);
    };
    // The children that refine the hub end `hub` of edge `e` (not those that
    // refine the counterpart), each with the way it runs at its own hub end.
    // `other` is the parent's counterpart end: a pool under the hub must not
    // pass for a refinement of it.
    const hubKids = (e, hub, other) => {
      const out = [];
      for (const k of (kidsOf.get(`${e.id}|to`) || []).concat(kidsOf.get(`${e.id}|from`) || [])) {
        if (k.to !== hub && k.to !== other && this.within(k.to, hub)) out.push([k, 'in']);
        else if (k.from !== hub && k.from !== other && this.within(k.from, hub)) out.push([k, 'out']);
      }
      return out;
    };
    for (const r of roots) { walk(r, 'in'); walk(r, 'out'); }
    return totals;
  }

  validate() {
    const problems = [];
    for (const e of this.edges.values()) {
      if (!Number.isInteger(e.keur) || e.keur < 0) problems.push(`${e.id}: keur ${e.keur}`);
      if (e.derivation !== 'residual' && !e.prov.length) problems.push(`${e.id}: no provenance`);
      for (const p of e.prov) if (this.registry && !this.registry.records.has(p)) problems.push(`${e.id}: provenance ${p} unknown`);
    }
    for (const n of this.nodes.values()) if (n.parent && !this.nodes.has(n.parent)) problems.push(`${n.id}: parent missing`);
    return problems;
  }

  toJSON() {
    const totals = this.totals();
    const nodes = Array.from(this.nodes.values()).sort((a, b) => (a.id < b.id ? -1 : 1)).map(n => ({ ...n, totals: totals.get(n.id) || {} }));
    const edges = Array.from(this.edges.values()).sort((a, b) => (a.id < b.id ? -1 : 1));
    return { nodes, edges };
  }
  // The sanity of the split sums without serialising: used by the checks.
  splitProblems() {
    const problems = [];
    const byParent = new Map();
    for (const e of this.edges.values()) if (e.parent && e.split !== 'op') { if (!byParent.has(e.parent)) byParent.set(e.parent, []); byParent.get(e.parent).push(e); }
    for (const [pid, kids] of byParent) { const p = this.edges.get(pid); const sum = kids.reduce((s, e) => s + (e.sign || 1) * e.keur, 0); if (Math.abs(sum - p.keur - (p.consolidated || 0)) > kids.length && !p.flags.includes('over-coverage')) problems.push(`${pid}: ${sum} vs ${p.keur}`); }
    return problems;
  }

  // emit(dir, { release, built }) writes the shards the site reads.
  emit(dir, { release, built, years, bases, vintages = [], controls = {}, defaultYear, provisional = [] }) {
    const { nodes, edges } = this.toJSON();
    const rel = path.join(dir, 'r', release);
    fs.rmSync(path.join(dir, 'r'), { recursive: true, force: true });
    fs.mkdirSync(path.join(rel, 'edges'), { recursive: true });
    const write = (file, data) => { fs.mkdirSync(path.dirname(path.join(rel, file)), { recursive: true }); fs.writeFileSync(path.join(rel, file), stable(data) + '\n'); };
    // Nodes and edges marked `focus` go to a shard of their own, loaded when their group opens.
    write('nodes.json', nodes.filter(n => !n.focus));
    const groups = new Map();
    const focusGroups = new Map();
    for (const e of edges) {
      if (e.focus) { const k = `${e.year}-${e.basis}|${e.focus}`; if (!focusGroups.has(k)) focusGroups.set(k, { key: `${e.year}-${e.basis}`, focus: e.focus, edges: [], nodes: [] }); focusGroups.get(k).edges.push(e); continue; }
      const k = `${e.year}-${e.basis}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e);
    }
    const byFocus = new Map(Array.from(focusGroups.values()).map(g => [g.focus, g]));
    for (const n of nodes) if (n.focus && byFocus.has(n.focus)) byFocus.get(n.focus).nodes.push(n);
    // Provenance records that only a focus shard refers to travel with it.
    const allProv = this.registry ? this.registry.toJSON() : { sources: {}, records: {} };
    const mainRefs = new Set();
    for (const list of groups.values()) for (const e of list) for (const p of e.prov || []) mainRefs.add(p);
    for (const n of nodes) { if (n.focus) continue; for (const p of n.prov || []) mainRefs.add(p); for (const f of ['functions', 'benefits']) if (n[f]) for (const v of Object.values(n[f])) { if (v.totalProv) mainRefs.add(v.totalProv); for (const i of v.items) mainRefs.add(i.prov); } }
    const focusOnly = new Set();
    for (const g of focusGroups.values()) for (const e of g.edges) for (const p of e.prov || []) if (!mainRefs.has(p)) focusOnly.add(p);
    const mainRecords = Object.fromEntries(Object.entries(allProv.records).filter(([id]) => !focusOnly.has(id)));
    write('provenance.json', { sources: allProv.sources, records: mainRecords });
    const shards = { nodes: `r/${release}/nodes.json`, provenance: `r/${release}/provenance.json`, edges: {}, focus: {} };
    for (const [k, list] of groups) { write(`edges/${k}.json`, list); shards.edges[k.replace('-', '/')] = `r/${release}/edges/${k}.json`; }
    for (const g of focusGroups.values()) {
      const file = `focus/${g.key}/${g.focus}.json`;
      const prov = {}; for (const e of g.edges) for (const p of e.prov || []) if (focusOnly.has(p)) prov[p] = allProv.records[p];
      const ops = {}; for (const e of g.edges) if (!e.opLabel && this.ops && this.ops[e.op]) ops[e.op] = this.ops[e.op];
      write(file, { nodes: g.nodes, ...compactFocus(g, this), prov, ops });
      const key = g.key.replace('-', '/'); if (!shards.focus[key]) shards.focus[key] = {}; shards.focus[key][g.focus] = `r/${release}/${file}`;
    }
    // The search index: every node of a hub tree, the communes included, as rows
    // [id, label, where it sits, year of its latest figures in its own basis, amount, focus shard or ''].
    // The basis is the tree the node belongs to: local accounts, State budget, else national accounts.
    const byId = new Map(nodes.map(n => [n.id, n]));
    const rows = [];
    for (const n of nodes) {
      if (n.role !== 'hub' || n.pool) continue;
      const basis = n.id.startsWith('OFGL') ? 'local-ofgl' : n.id.includes('.M.') ? 'budget-plf' : 'sna';
      const wanted = basis === 'sna' && defaultYear ? `${defaultYear}/sna` : null;
      const keys = Object.keys(n.totals || {}).filter(k => k.endsWith(`/${basis}`)).sort().reverse();
      const key = wanted && keys.includes(wanted) ? wanted : keys[0];
      if (!key) continue;
      const t = n.totals[key];
      const parent = n.parent ? byId.get(n.parent) : null;
      const code = n.codes && (n.codes.insee || n.codes.dep_code);
      rows.push([n.id, n.label, [parent ? parent.short || parent.label : '', code || ''].filter(Boolean).join(', '), Number(key.split('/')[0]), Math.max(t.in || 0, t.out || 0), n.focus || '']);
    }
    rows.sort((a, b) => (b[4] - a[4]) || a[0].localeCompare(b[0]));
    write('search.json', { columns: ['id', 'label', 'context', 'year', 'keur', 'focus'], rows });
    shards.search = `r/${release}/search.json`;
    const index = { release, built, years, defaultYear: defaultYear || years[years.length - 1], provisional, bases, vintages, controls, counts: { nodes: nodes.length, edges: edges.length }, shards, log: this.log };
    fs.writeFileSync(path.join(dir, 'index.json'), stable(index) + '\n');
    return index;
  }
}

// A focus shard holds the leaf edges of many entities that all follow the
// same pattern (one edge per operation, hanging from the group's edge of
// that operation). They are written as a table: one template per
// operation and one row of values per entity, the site expanding them
// back into edges (flux/js/compact.js). Values are signed: a negative one
// runs the other way.
function compactFocus(g, graph) {
  const templates = new Map();
  const rows = new Map();
  for (const e of g.edges) {
    const entity = [e.from, e.to].find(x => { const n = graph.nodes.get(x); return n && n.focus === g.focus; });
    if (!entity) return { edges: g.edges };
    const hubIsFrom = e.from === entity;
    const other = hubIsFrom ? e.to : e.from;
    const parent = graph.edges.get(e.parent);
    const parentHubIsFrom = parent ? graph.within(entity, parent.from) : hubIsFrom;
    // The template direction is the parent's; a child the other way carries a negative value.
    const sameWay = hubIsFrom === parentHubIsFrom;
    const key = `${e.op}|${other}|${e.parent}`;
    if (!templates.has(key)) templates.set(key, { op: e.op, other, parent: e.parent, split: e.split, hubIsFrom: parentHubIsFrom, derivation: e.derivation });
    const t = templates.get(key);
    if (t.derivation !== e.derivation) t.derivation = 'direct';
    if (!rows.has(entity)) rows.set(entity, { id: entity, prov: e.prov[0], values: {} });
    rows.get(entity).values[key] = sameWay ? e.keur : -e.keur;
  }
  const keys = Array.from(templates.keys());
  return { table: { templates: keys.map(k => templates.get(k)), entities: Array.from(rows.values()).map(r => ({ id: r.id, prov: r.prov, values: keys.map(k => r.values[k] ?? null) })) }, edges: [] };
}

module.exports = { Graph, KINDS, BASES, DERIVATIONS, SPLITS, ND, stable, sortKeys, compactFocus };
