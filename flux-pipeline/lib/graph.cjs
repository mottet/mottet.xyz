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
      // the other sign, against it (-1); the signed children sum to the parent.
      if (e.split === 'op') e.sign = 1;
      else if (e.split === 'to') e.sign = e.from === parent.from ? 1 : (e.to === parent.from ? -1 : 1);
      else e.sign = e.to === parent.to ? 1 : (e.from === parent.to ? -1 : 1);
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
    const walk = (e, side) => {
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
      const finer = kidsOf.get(`${e.id}|${side === 'in' ? 'to' : 'from'}`) || [];
      for (const k of finer) walkFiner(k, side);
    };
    // Below a split, only the finer node (not its ancestors, already counted) takes the amount.
    const walkFiner = (e, side) => {
      if ((e.sign || 1) < 0) side = side === 'in' ? 'out' : 'in'; // a sub-sector whose balance runs the other way
      const end = side === 'in' ? e.to : e.from;
      const key = `${e.year}/${e.basis}`;
      const parent = this.edges.get(e.parent);
      const parentEnd = (e.sign || 1) < 0 ? (side === 'in' ? parent.from : parent.to) : (side === 'in' ? parent.to : parent.from);
      add(end, key, side, e.keur);
      for (const a of this.ancestors(end)) { if (a === parentEnd) break; add(a, key, side, e.keur); }
      const finer = kidsOf.get(`${e.id}|${side === 'in' ? 'to' : 'from'}`) || [];
      for (const k of finer) walkFiner(k, side);
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

  // emit(dir, { release, built }) writes the shards the site reads.
  emit(dir, { release, built, years, bases, vintages = [], controls = {}, defaultYear, provisional = [] }) {
    const { nodes, edges } = this.toJSON();
    const rel = path.join(dir, 'r', release);
    fs.rmSync(path.join(dir, 'r'), { recursive: true, force: true });
    fs.mkdirSync(path.join(rel, 'edges'), { recursive: true });
    const write = (file, data) => fs.writeFileSync(path.join(rel, file), stable(data) + '\n');
    write('nodes.json', nodes);
    write('provenance.json', this.registry ? this.registry.toJSON() : { sources: {}, records: {} });
    const groups = new Map();
    for (const e of edges) { const k = `${e.year}-${e.basis}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
    const shards = { nodes: `r/${release}/nodes.json`, provenance: `r/${release}/provenance.json`, edges: {} };
    for (const [k, list] of groups) { write(`edges/${k}.json`, list); shards.edges[k.replace('-', '/')] = `r/${release}/edges/${k}.json`; }
    const index = { release, built, years, defaultYear: defaultYear || years[years.length - 1], provisional, bases, vintages, controls, counts: { nodes: nodes.length, edges: edges.length }, shards, log: this.log };
    fs.writeFileSync(path.join(dir, 'index.json'), stable(index) + '\n');
    return index;
  }
}

module.exports = { Graph, KINDS, BASES, DERIVATIONS, SPLITS, ND, stable, sortKeys };
