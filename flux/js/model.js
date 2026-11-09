// The graph model: the nodes and edges of one release, and the pure rules
// that turn a view (year, basis, which nodes are expanded, how fine each
// column is) into the ribbons to draw. The pipeline guarantees that the
// children of a split sum to their parent, so any cut through the trees
// gives totals that agree with the official figures above them.
//
// For every root edge the selection walks down the splits the view asks
// for: the hub end first (a receipt's `to`, an expense's `from`), then the
// counterpart end when the view wants payers or beneficiaries finer than
// the edge names (through a `from`/`to` split, or through an operation
// split whose children name their counterparts), then the operation when
// the view shows operations. What the data cannot split is drawn as a
// "non ventilé" block inside the expanded node, never guessed.

/** @typedef {{id:string,parent?:string,kind:string,level:number,label:string,short:string,role:string,rank:number,aggregate?:boolean,synthetic?:boolean,totals:Record<string,{in:number,out:number}>}} Node */
/** @typedef {{id:string,from:string,to:string,op:string,opLabel:string,year:number,basis:string,keur:number,parent?:string,split?:string,sign?:number,derivation:string,prov:string[],flags:string[],alt?:string,note?:string,consolidated?:number,detail?:any[]}} Edge */

export const HUB = 'S13';
/** The pool of transfers between administrations sits under the hub but is never a column node. */
export const POOL = 'POOL';

export class Model {
  /** @param {Node[]} nodes */
  constructor(nodes) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.children = new Map();
    for (const n of nodes) {
      const key = n.parent || '';
      if (!this.children.has(key)) this.children.set(key, []);
      this.children.get(key).push(n.id);
    }
    for (const list of this.children.values()) list.sort((a, b) => this.nodes.get(a).rank - this.nodes.get(b).rank || (a < b ? -1 : 1));
    this.edgesByKey = new Map(); // `${year}/${basis}` -> { list, byId, kids }
  }

  /** Adds one shard of edges. */
  addEdges(key, edges) {
    const byId = new Map(edges.map(e => [e.id, e]));
    const kids = new Map();
    for (const e of edges) if (e.parent) {
      const k = `${e.parent}|${e.split}`;
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(e);
    }
    this.edgesByKey.set(key, { list: edges, byId, kids });
  }
  hasEdges(key) { return this.edgesByKey.has(key); }

  node(id) { return this.nodes.get(id); }
  kidsOf(id) { return this.children.get(id) || []; }
  ancestors(id) { const out = []; let n = this.nodes.get(id); while (n && n.parent) { out.push(n.parent); n = this.nodes.get(n.parent); } return out; }
  isHub(id, root = this.root || HUB) { return id === root || this.ancestors(id).includes(root); }
  within(id, ancestor) { return id === ancestor || this.ancestors(id).includes(ancestor); }
  isPool(id) { const n = this.nodes.get(id); return Boolean(n && n.pool) || id === POOL; }
  depth(id) { return this.nodes.get(id)?.level ?? 0; }

  /**
   * The nodes a column shows: start from the roots of that side, replace
   * every node at a level under `level` by its children, then replace
   * every node in `expanded` by its children. Returns an ordered list and
   * the set of nodes that are "open" (ancestors of visible nodes).
   */
  cut(roots, { level = 0, expanded = new Set(), max = Infinity, hubOnly = false } = {}) {
    const visible = [];
    const open = new Set();
    const walk = (id, depthFromRoot) => {
      const kids = this.kidsOf(id).filter(k => !this.isPool(k) && (!hubOnly || this.isHub(k)));
      const wants = kids.length && (depthFromRoot < level || expanded.has(id));
      if (!wants) { visible.push(id); return; }
      open.add(id);
      for (const k of kids) walk(k, depthFromRoot + 1);
    };
    for (const r of roots) walk(r, 0);
    return { visible, open };
  }

  /**
   * Resolves which node an edge end lands on in a column:
   * - a visible node, or a descendant of one -> that visible node;
   * - an open node (expanded, so not drawable itself) -> `${id}.*`, the
   *   "non ventilé" block inside it;
   * - anything else (a counterpart class the column did not list) -> itself.
   */
  place(id, visibleSet, open) {
    if (visibleSet.has(id)) return id;
    for (const a of this.ancestors(id)) if (visibleSet.has(a)) return a;
    if (open.has(id)) return `${id}.*`;
    return id;
  }

  /**
   * The ribbons for a view.
   * @param {{year:number,basis:string,hub:{level:number,expanded:Set<string>},side:{ops:boolean,expanded:Set<string>}}} view
   */
  select(view) {
    const key = `${view.year}/${view.basis}`;
    const shard = this.edgesByKey.get(key);
    if (!shard) return null;
    this.root = view.root || HUB;
    const hubCut = this.cut([this.root], { level: view.hub.level, expanded: view.hub.expanded, hubOnly: true });
    const hubVisible = new Set(hubCut.visible);
    const hubNode = id => this.isHub(id) && !this.isPool(id);
    const hubEnd = e => (hubNode(e.to) && !hubNode(e.from) ? 'to' : (hubNode(e.from) && !hubNode(e.to) ? 'from' : null));
    const kids = (e, split) => (split === 'op' ? (shard.kids.get(`${e.id}|op`) || []) : (shard.kids.get(`${e.id}|${split}`) || []).concat(split === 'to' || split === 'from' ? [] : []));
    // The hub-side split may be named after the direction the parent had before it was flipped: take both.
    const hubKids = e => (shard.kids.get(`${e.id}|to`) || []).concat(shard.kids.get(`${e.id}|from`) || []);
    const sideExpanded = view.side.expanded;
    const picked = [];

    const walk = (e, state) => {
      const hs = hubEnd(e);
      // 1. The hub end, as fine as the hub column asks.
      if (hs) {
        const end = e[hs];
        if (hubCut.open.has(end)) {
          const k = hubKids(e).filter(c => this.within(c.to, end) || this.within(c.from, end));
          if (k.length) { for (const c of k) walk(c, state); return; }
          picked.push({ edge: e, unsplit: hs }); return;
        }
      }
      // 2. The counterpart end: a widened aggregate or an expanded node is
      //    refined through its own split, or through operations that name
      //    their counterparts.
      const cs = hs === 'to' ? 'from' : (hs === 'from' ? 'to' : null);
      if (cs && !state.opDone) {
        const end = e[cs];
        const node = this.nodes.get(end);
        const wants = (node && node.aggregate) || sideExpanded.has(end) || view.side.ops;
        if (wants) {
          let k = kids(e, cs);
          if (k.length) { for (const c of k) walk(c, { ...state, cDone: true }); return; }
          k = kids(e, 'op');
          if (k.length && (view.side.ops || k.some(c => c[cs] !== end))) { for (const c of k) walk(c, { ...state, opDone: true }); return; }
        }
      }
      picked.push({ edge: e });
    };

    // Root edges; an `alt` root replaces its sibling when the hub end stays
    // collapsed and the view wants payers by sector (that is what it is for).
    const roots = shard.list.filter(e => !e.parent);
    const altFor = new Map();
    for (const r of roots) if (r.alt) altFor.set(`${r.from}>${r.to}:${r.op}`, r);
    for (const r of roots) {
      if (r.alt) continue;
      // Transfers between administrations exist at every level with that
      // level's own figure: only the ones whose hub end is on screen count.
      if (r.flags.includes('intra')) { const hs = this.isPool(r.from) ? 'to' : 'from'; if (!hubVisible.has(r[hs])) continue; picked.push({ edge: r }); continue; }
      const alt = altFor.get(`${r.from}>${r.to}:${r.op}`);
      const hs = hubEnd(r);
      const useAlt = alt && hs && !hubCut.open.has(r[hs]) && !view.side.ops;
      walk(useAlt ? alt : r, {});
    }
    return { picked, hubCut, hubVisible, key };
  }

  /**
   * Bundles the picked edges into one ribbon per (payer, hub node) or (hub
   * node, beneficiary) pair, placing each end in its column. Flows with both
   * ends inside the hub are returned apart (`intra`).
   */
  rollup(selection, { sideExpanded = new Set() } = {}) {
    const { picked, hubCut, hubVisible } = selection;
    const sideOpen = new Set();
    const sideVisible = new Set();
    // Counterpart nodes are visible as themselves unless expanded.
    for (const { edge } of picked) for (const end of [edge.from, edge.to]) if (!this.isHub(end) || this.isPool(end)) {
      if (sideExpanded.has(end) && this.kidsOf(end).length) { sideOpen.add(end); for (const k of this.kidsOf(end)) sideVisible.add(k); }
      else { let placed = end; for (const a of this.ancestors(end)) if (sideExpanded.has(a)) { placed = end; break; } sideVisible.add(placed); }
    }
    const ribbons = new Map();
    const intra = [];
    const members = new Map();
    for (const p of picked) {
      const e = p.edge;
      // The pool of transfers between administrations is drawn as a
      // counterpart ("autres administrations") on the side facing the hub end.
      const fromHub = this.isHub(e.from) && !this.isPool(e.from), toHub = this.isHub(e.to) && !this.isPool(e.to);
      if (fromHub && toHub) { intra.push(p); continue; }
      let from = fromHub ? this.place(e.from, hubVisible, hubCut.open) : (this.isPool(e.from) ? e.from : this.placeSide(e.from, sideVisible, sideOpen));
      let to = toHub ? this.place(e.to, hubVisible, hubCut.open) : (this.isPool(e.to) ? e.to : this.placeSide(e.to, sideVisible, sideOpen));
      if (p.unsplit === 'to') to = `${e.to}.*`;
      if (p.unsplit === 'from') from = `${e.from}.*`;
      const side = fromHub ? 'benef' : 'payeurs';
      const k = `${from}>${to}`;
      if (!ribbons.has(k)) ribbons.set(k, { from, to, side, keur: 0, edges: [], ops: new Map() });
      const r = ribbons.get(k);
      r.keur += e.keur;
      r.edges.push(e);
      const op = r.ops.get(e.op) || { op: e.op, label: e.opLabel, keur: 0 };
      op.keur += e.keur; r.ops.set(e.op, op);
      members.set(k, r);
    }
    return { ribbons: Array.from(ribbons.values()), intra, hubVisible: hubCut.visible, hubOpen: hubCut.open, sideVisible, sideOpen };
  }
  placeSide(id, visible, open) {
    if (visible.has(id)) return id;
    for (const a of this.ancestors(id)) if (visible.has(a)) return a;
    if (open.has(id)) return `${id}.*`;
    return id;
  }

  /** Every provenance id behind a list of ribbons. */
  sourcesOf(ribbons) {
    const out = new Set();
    for (const r of ribbons) for (const e of r.edges) for (const p of e.prov || []) out.add(p);
    return out;
  }
}

/** The display id of a "non ventilé" block and the node it belongs to. */
export const isUnsplit = id => id.endsWith('.*');
export const unsplitOf = id => id.slice(0, -2);
