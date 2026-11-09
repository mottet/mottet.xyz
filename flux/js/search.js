// Search over the hub trees: administrations, missions, programmes,
// actions, départements, and every commune and intercommunalité. The index
// is a shard of rows [id, label, context, year, keur, focus] sorted by
// amount, loaded the first time the box is used.

/** Lower case, no accents, apostrophes and hyphens as spaces. */
export const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'\-–:,()]/g, ' ').replace(/\s+/g, ' ').trim();

export class SearchIndex {
  constructor({ rows }) {
    this.rows = rows;
    // The name is what follows the kind ("Commune : Brest", "Programme 105 – Action…").
    this.names = rows.map(r => fold(r[1].replace(/^[^:–]{1,40}[:–]\s*/, '')));
    this.full = rows.map(r => fold(`${r[1]} ${r[2]}`));
  }
  /** Rows matching every word of the query: exact names first, then names that start with it, then words that do, then the rest; within a rank, the biggest amounts first. */
  find(query, limit = 12) {
    const q = fold(query);
    if (q.length < 2) return [];
    const terms = q.split(' ');
    const ranks = [[], [], [], []];
    for (let i = 0; i < this.rows.length; i++) {
      const full = this.full[i];
      let ok = true;
      for (const t of terms) if (!full.includes(t)) { ok = false; break; }
      if (!ok) continue;
      const name = this.names[i];
      const rank = name === q ? 0 : name.startsWith(q) ? 1 : (` ${full}`).includes(` ${terms[0]}`) ? 2 : 3;
      if (ranks[rank].length < limit) ranks[rank].push(this.rows[i]);
    }
    return ranks.flat().slice(0, limit).map(([id, label, context, year, keur, focus]) => ({ id, label, context, year, keur, focus }));
  }
}

/** The basis a node belongs to, from the tree its id sits in. */
export const basisOf = id => (id.startsWith('OFGL') ? 'local-ofgl' : id.includes('.M.') ? 'budget-plf' : 'sna');
