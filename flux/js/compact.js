// A focus shard written as a table (one template per operation, one row of
// values per entity) expanded back into edges. A negative value runs the
// other way than its template. Used by the site and by the data check.

export function expandFocus(shard, { year, basis }) {
  if (!shard.table) return shard.edges || [];
  const { templates, entities } = shard.table;
  const edges = [];
  for (const row of entities) {
    templates.forEach((t, i) => {
      const v = row.values[i];
      if (v === null || v === undefined || v === 0) return;
      const keur = Math.abs(v);
      const hubIsFrom = v > 0 ? t.hubIsFrom : !t.hubIsFrom;
      const from = hubIsFrom ? row.id : t.other, to = hubIsFrom ? t.other : row.id;
      edges.push({ id: `${row.id}|${t.op}`, from, to, op: t.op, opLabel: (shard.ops && shard.ops[t.op]) || t.op, year, basis, keur, parent: t.parent, split: t.split, sign: v > 0 ? 1 : -1, derivation: t.derivation, prov: [row.prov], flags: v > 0 ? [] : ['sign-flipped'] });
    });
  }
  return edges;
}
