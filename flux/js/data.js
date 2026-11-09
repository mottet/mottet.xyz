// Loading the shards: the index once (revalidated), then nodes, provenance
// and one edge shard per year and basis, each fetched once and kept.

export class Data {
  constructor(base = 'graph/') {
    this.base = base;
    this.index = null;
    this.cache = new Map();
    this.inflight = new Map();
  }
  async json(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    if (this.inflight.has(path)) return this.inflight.get(path);
    const p = fetch(this.base + path).then(async r => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      const v = await r.json();
      this.cache.set(path, v);
      this.inflight.delete(path);
      return v;
    }).catch(e => { this.inflight.delete(path); throw e; });
    this.inflight.set(path, p);
    return p;
  }
  async loadIndex() {
    this.index = await this.json('index.json');
    return this.index;
  }
  nodes() { return this.json(this.index.shards.nodes); }
  provenance() { return this.json(this.index.shards.provenance); }
  edges(year, basis) {
    const file = this.index.shards.edges[`${year}/${basis}`];
    if (!file) return Promise.resolve(null);
    return this.json(file);
  }
  search() { return this.index.shards.search ? this.json(this.index.shards.search) : Promise.resolve({ rows: [] }); }
  has(year, basis) { return Boolean(this.index && this.index.shards.edges[`${year}/${basis}`]); }
  focusFile(year, basis, id) { const f = this.index && this.index.shards.focus && this.index.shards.focus[`${year}/${basis}`]; return f ? f[id] || null : null; }
  focus(year, basis, id) { const file = this.focusFile(year, basis, id); return file ? this.json(file) : Promise.resolve(null); }
}
