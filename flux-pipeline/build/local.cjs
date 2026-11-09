'use strict';

// The local authorities as their accounts show them: the OFGL consolidated
// bases (comptes de gestion, main and annex budgets, flows between them
// neutralised) for communes, intercommunalités à fiscalité propre,
// départements and régions. Basis `local-ofgl`. The hub is the OFGL root,
// then the four types, then départements and régions as entities and
// communes and intercommunalités grouped by département and région; the
// entities of a group live in a focus shard loaded when the group opens.
// Every amount is an OFGL aggregate (or the difference of two, said so);
// the receipt and expense lists partition the totals, and the year's
// change in working capital closes the balance.
const { toKeur } = require('../lib/units.cjs');
const M = require('../mappings/ofgl.json');

const ROOT = 'OFGL';
const POOL = 'OFGL.POOL';

async function fetchLocal({ ods, year, offline, types = Object.keys(M.types) }) {
  const where = `exer=date'${year}'`;
  const out = {};
  for (const t of types) {
    const def = M.types[t];
    const q = { where, group_by: 'agregat', select: 'agregat,sum(montant) as montant,count(*) as n' };
    const total = await ods.exportJson(def.dataset, q, { offline });
    let groups = null, entities = null;
    if (def.group) groups = await ods.exportJson(def.dataset, { where, group_by: `${def.group},${def.groupName},agregat`, select: `${def.group} as code,${def.groupName} as name,agregat,sum(montant) as montant,count(*) as n` }, { offline });
    if (def.entity) entities = await ods.exportJson(def.dataset, { where, select: 'siren,lbudg,agregat,montant,ptot' }, { offline });
    if (def.groupFromEntities) {
      // An intercommunalité can sit in two régions and the portal's group_by then counts it twice: group the rows here by the first région named.
      const rows = (await ods.exportJson(def.dataset, { where, select: def.entityFields }, { offline })).rows;
      const first = v => (Array.isArray(v) ? v[0] : String(v || '').split(/[;,]/)[0].trim());
      const byGroup = new Map();
      for (const r of rows) { const code = first(r[def.groupFromEntities]) || '00', name = first(r[def.groupName]) || 'Région inconnue'; const k = `${code}|${name}|${r.agregat}`; const o = byGroup.get(k) || { code, name, agregat: r.agregat, montant: 0, n: 0 }; o.montant += Number(r.montant) || 0; o.n++; byGroup.set(k, o); }
      groups = { rows: Array.from(byGroup.values()), url: `${def.dataset} entity rows grouped by first ${def.groupFromEntities}` };
      out[t] = { total: await ods.exportJson(def.dataset, q, { offline }), groups, entities: null, dataset: def.dataset, entityRows: rows };
      continue;
    }
    out[t] = { total, groups, entities, dataset: def.dataset };
  }
  return out;
}

function buildLocal({ graph, registry, year, data, source = 'ofgl' }) {
  const basis = 'local-ofgl';
  const nodeOnce = def => (graph.nodes.has(def.id) ? graph.nodes.get(def.id) : graph.node(def));
  const mapProv = registry.prov(source, { file: 'flux-pipeline/mappings/ofgl.json', key: 'receipts/expenses' }, { note: 'Correspondance agrégat OFGL → contrepartie.' });
  const prov = (dataset, where, key, field = 'montant') => registry.prov(source, { dataset, query: `exports/json?where=${where}&group_by=…`, key, field }, { unitIn: 'EUR' });

  nodeOnce({ id: ROOT, kind: 'sector', label: 'Collectivités locales (comptes de gestion, OFGL)', short: 'Collectivités locales', role: 'hub', codes: {} });
  for (const [id, c] of Object.entries(M.classes)) nodeOnce({ id, kind: 'class', label: c.label, short: c.short, role: c.role });
  let rank = 0;
  for (const [t, def] of Object.entries(M.types)) nodeOnce({ id: `${ROOT}.${t}`, parent: ROOT, kind: 'localtype', label: def.label, short: def.label, role: 'hub', rank: rank++ });

  const K = v => toKeur(Number(v) || 0, 'EUR');
  const sumRows = (rows, agregat) => rows.filter(r => r.agregat === agregat).reduce((s, r) => s + K(r.montant), 0);
  const ids = new Set();
  const edge = def => { if (ids.has(def.id)) throw new Error(`edge ${def.id} twice`); ids.add(def.id); return graph.edge({ ...def, year, basis }); };
  const eid = (from, to, op, scope) => `${year}:${basis}:${from}>${to}:${op}:${scope}`;

  // One level: amounts of every item for a hub node, from a list of rows.
  const items = (rows) => {
    const out = [];
    for (const r of M.receipts) {
      let keur = sumRows(rows, r.agregat); if (r.minus) keur -= sumRows(rows, r.minus);
      out.push({ ...r, keur, side: 'in' });
    }
    for (const e of M.expenses) {
      let keur = sumRows(rows, e.agregat); if (e.minus) keur -= sumRows(rows, e.minus);
      out.push({ ...e, keur, side: 'out' });
    }
    const totalIn = sumRows(rows, M.receiptsTotal), totalOut = sumRows(rows, M.expensesTotal), balance = sumRows(rows, M.balance);
    return { out, totalIn, totalOut, balance };
  };
  const check = (label, it) => {
    const sIn = it.out.filter(x => x.side === 'in').reduce((s, x) => s + x.keur, 0), sOut = it.out.filter(x => x.side === 'out').reduce((s, x) => s + x.keur, 0);
    const tol = Math.max(50000, Math.round(it.totalIn * 0.002));
    if (Math.abs(sIn - it.totalIn) > tol) throw new Error(`${label}: receipts ${sIn} vs total ${it.totalIn}`);
    if (Math.abs(sOut - it.totalOut) > tol) throw new Error(`${label}: expenses ${sOut} vs total ${it.totalOut}`);
  };

  // Emit the items of one hub node as root edges or as children of the parent's edges.
  const emit = (hub, it, parentEdges, provOf, scope, focus) => {
    const made = {};
    for (const x of it.out) {
      if (x.keur === 0 && !parentEdges) continue;
      const from = x.side === 'in' ? x.from : hub, to = x.side === 'in' ? hub : x.to;
      const def = { id: eid(from, to, x.op, scope), from, to, op: x.op, opLabel: x.label, keur: x.keur, derivation: x.minus ? 'sum' : (parentEdges ? 'direct' : x.derivation), prov: [provOf(x), mapProv], note: x.minus ? `${x.agregat} moins ${x.minus}.` : undefined, flags: [] };
      if (parentEdges && parentEdges[x.op]) { def.parent = parentEdges[x.op].id; def.split = x.side === 'in' ? 'to' : 'from'; }
      if (focus) def.focus = focus;
      if (x.keur === 0 && parentEdges) continue;
      made[x.op] = edge(def);
    }
    // The balance: a draw on the working capital (deficit) comes in from FINANCEMENT, a build-up goes out to it.
    const bal = it.balance; // recettes − dépenses
    const def = bal < 0
      ? { id: eid('FINANCEMENT', hub, 'FDR', scope), from: 'FINANCEMENT', to: hub, keur: -bal }
      : { id: eid(hub, 'FINANCEMENT', 'FDR', scope), from: hub, to: 'FINANCEMENT', keur: bal };
    const e = { ...def, op: 'FDR', opLabel: 'Variation du fonds de roulement (recettes moins dépenses)', derivation: 'direct', prov: [provOf({ agregat: M.balance })], note: 'Différence entre les recettes et les dépenses réelles de l’année : négative, elle est prise sur les réserves ; positive, elle les augmente.' };
    if (parentEdges && parentEdges.FDR) { e.parent = parentEdges.FDR.id; e.split = parentEdges.FDR.to === 'FINANCEMENT' ? (bal >= 0 ? 'from' : 'from') : 'to'; if (parentEdges.FDR.from === 'FINANCEMENT') e.split = 'to'; }
    if (focus) e.focus = focus;
    made.FDR = edge(e);
    return made;
  };

  // Root: the sum of the four types.
  const allRows = Object.entries(data).flatMap(([t, d]) => d.total.rows.map(r => ({ ...r, type: t })));
  const rootItems = items(allRows);
  check('OFGL root', rootItems);
  const rootEdges = emit(ROOT, rootItems, null, x => prov('*', `exer=date'${year}'`, { agregat: x.agregat, minus: x.minus, types: Object.keys(data) }), 'root');
  // Types.
  for (const [t, d] of Object.entries(data)) {
    const hub = `${ROOT}.${t}`;
    const it = items(d.total.rows);
    check(hub, it);
    const typeEdges = emit(hub, it, rootEdges, x => prov(d.dataset, `exer=date'${year}'`, { agregat: x.agregat, minus: x.minus }), t);
    const def = M.types[t];
    if (d.groups) {
      const byGroup = new Map();
      for (const r of d.groups.rows) { if (!byGroup.has(r.code)) byGroup.set(r.code, { name: r.name, rows: [] }); byGroup.get(r.code).rows.push(r); }
      let gr = 0;
      for (const [code, g] of Array.from(byGroup.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const gid = `${hub}.${(def.group || def.groupFromEntities) === 'dep_code' ? 'D' : 'R'}${code}`;
        nodeOnce({ id: gid, parent: hub, kind: 'localtype', label: `${def.label} : ${g.name}`, short: g.name, role: 'hub', rank: gr++, codes: { [def.group]: code }, focus: gid });
        const git = items(g.rows);
        const gk = def.group || def.groupFromEntities;
        emit(gid, git, typeEdges, x => prov(d.dataset, `exer=date'${year}' and ${gk}='${code}'`, { [gk]: code, agregat: x.agregat, minus: x.minus, note: def.groupFromEntities ? 'première région de rattachement' : undefined }), `${t}-${code}`);
      }
    }
    if (d.entities) {
      const byEntity = new Map();
      for (const r of d.entities.rows) { if (!byEntity.has(r.siren)) byEntity.set(r.siren, { name: r.lbudg, ptot: r.ptot, rows: [] }); byEntity.get(r.siren).rows.push(r); }
      let er = 0;
      for (const [siren, e] of Array.from(byEntity.entries()).sort((a, b) => (a[1].name < b[1].name ? -1 : 1))) {
        const eidn = `${hub}.E${siren}`;
        const name = String(e.name).replace(/^(DEP|REG|CTU|COLL)\s+/i, '').replace(/\b([A-ZÀ-Ü][A-ZÀ-Ü'-]+)\b/g, w => w.charAt(0) + w.slice(1).toLowerCase());
        nodeOnce({ id: eidn, parent: hub, kind: 'entity', label: `${def.label.replace(/s$/, '')} : ${name}`, short: name, role: 'hub', rank: er++, codes: { siren }, population: e.ptot || undefined });
        const it2 = items(e.rows);
        emit(eidn, it2, typeEdges, x => prov(d.dataset, `exer=date'${year}' and siren='${siren}'`, { siren, agregat: x.agregat, minus: x.minus }), `${t}-${siren}`);
      }
    }
  }
  return { totalIn: rootItems.totalIn, totalOut: rootItems.totalOut, balance: rootItems.balance };
}

module.exports = { fetchLocal, buildLocal, ROOT, POOL };
