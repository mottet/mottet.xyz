'use strict';

// Social protection as the DREES accounts it (comptes de la protection
// sociale): every régime, public and private. Basis `cps`.
//  - What comes in and the other uses, per group of régimes, from the
//    workbook's "opérations" sheets (totals exclude transfers between régimes).
//  - The benefits from the open dataset: by risk down to each benefit, and by
//    institutional sector down to each régime.
//  - The balance (resources minus uses) is computed and said so; below the
//    total it also carries the transfers between régimes, which the sheets
//    leave out.
const { toKeur } = require('../lib/units.cjs');
const MAP = require('../mappings/cps.json');

const ROOT = 'PS';
const BENEFITS = 'PREST';
const DATASET = '305_les-comptes-de-la-protection-sociale';
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48).replace(/-$/, '');
const colName = i => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** One "opérations" sheet -> { years: {2024: col}, rows: Map(label -> {line, values: {year: number}}) }. */
function readOperations(sheet) {
  const rows = sheet.rows();
  const years = {};
  rows[0].forEach((h, i) => { const m = /^(\d{4})(DEF|SD|R)?$/.exec(String(h || '')); if (m) years[Number(m[1])] = i; });
  const out = new Map();
  rows.forEach((r, i) => { if (i && typeof r[0] === 'string' && r[0].trim()) out.set(r[0].trim(), { line: i + 1, cells: r }); });
  return { years, rows: out, name: sheet.name };
}

function buildSocial({ graph, registry, workbook, rows, years, source = 'drees-cps', sheetSource = 'drees-cps-xlsx' }) {
  const basis = 'cps';
  const nodeOnce = def => (graph.nodes.has(def.id) ? graph.nodes.get(def.id) : graph.node(def));
  const mappingProv = registry.prov(sheetSource, { file: 'flux-pipeline/mappings/cps.json', key: 'resources, uses, groups' }, { note: 'Correspondance ligne du compte → payeur ou bénéficiaire, et secteur → groupe de régimes.' });
  const total = readOperations(workbook.sheet(MAP.totalSheet));
  const groups = Object.fromEntries(Object.entries(MAP.groups).map(([g, def]) => { const s = workbook.sheet(def.sheet); if (!s) throw new Error(`cps: sheet ${def.sheet} missing`); return [g, readOperations(s)]; }));
  const built = years.filter(y => total.years[y] !== undefined && Object.values(groups).every(g => g.years[y] !== undefined) && rows.some(r => Number(r.annee) === y));
  const cell = (ops, label, year) => {
    const row = ops.rows.get(label);
    if (!row) return null;
    const v = row.cells[ops.years[year]];
    if (v === null || v === undefined || v === '') return null;
    return { keur: toKeur(v, 'MEUR'), prov: registry.prov(sheetSource, { sheet: ops.name, cell: `${colName(ops.years[year])}${row.line}`, row: label, year }, { unitIn: 'MEUR' }) };
  };

  // Nodes: the hub tree (groups, sectors, régimes), the benefits tree, the classes.
  nodeOnce({ id: ROOT, kind: 'sector', label: 'Protection sociale : tous les régimes, publics et privés', short: 'Protection sociale', role: 'hub' });
  for (const [id, c] of Object.entries(MAP.classes)) nodeOnce({ id, kind: 'class', label: c.label, short: c.short, role: c.role });
  const groupOf = {};
  Object.entries(MAP.groups).forEach(([g, def], i) => { nodeOnce({ id: `${ROOT}.${g}`, parent: ROOT, kind: 'sector', label: def.label, short: def.short, role: 'hub', rank: i }); def.sectors.forEach(s => { groupOf[s] = g; }); });
  const mine = rows.filter(r => built.includes(Number(r.annee)));
  const isTotal = r => /^Total /.test(r.regime_nom);
  const sectorId = code => `${ROOT}.${groupOf[code]}.${code}`;
  const regimeId = r => `${sectorId(r.si_code)}.${slug(r.regime_nom)}`;
  // A sector with a single régime is not opened further.
  const regimesOf = new Map();
  for (const r of mine) if (r.si_niveau === '2') { if (!regimesOf.has(r.si_code)) regimesOf.set(r.si_code, new Set()); regimesOf.get(r.si_code).add(r.regime_nom); }
  const leafId = r => (regimesOf.get(r.si_code).size > 1 ? regimeId(r) : sectorId(r.si_code));
  for (const r of mine) {
    if (r.si_niveau === '0') continue;
    if (!groupOf[r.si_code]) throw new Error(`cps: sector ${r.si_code} (${r.si_nom}) is in no group`);
    const g = groupOf[r.si_code];
    nodeOnce({ id: sectorId(r.si_code), parent: `${ROOT}.${g}`, kind: 'sector', label: r.si_nom, short: r.si_nom, role: 'hub', codes: { si_code: r.si_code }, rank: MAP.groups[g].sectors.indexOf(r.si_code) });
    if (r.si_niveau === '2' && regimesOf.get(r.si_code).size > 1) nodeOnce({ id: regimeId(r), parent: sectorId(r.si_code), kind: 'sector', label: r.regime_nom, short: r.regime_nom, role: 'hub' });
  }
  const benefitId = code => `${BENEFITS}.R${code.replace(/^E11-/, '')}`;
  const parentCode = (code, level) => { const c = code.replace(/^E11-/, ''); if (level <= 1) return null; if (level === 2) return `E11-${c[0]}`; return `E11-${c.slice(0, c.lastIndexOf('.'))}`; };
  nodeOnce({ id: BENEFITS, kind: 'benefit', label: 'Ménages : prestations de protection sociale, par risque', short: 'Prestations aux ménages', role: 'beneficiary' });
  const benefitRows = new Map();
  for (const r of mine) if (r.ps_niveau !== '0' && !benefitRows.has(r.ps_code)) benefitRows.set(r.ps_code, r);
  for (const r of Array.from(benefitRows.values()).sort((a, b) => Number(a.ps_niveau) - Number(b.ps_niveau) || a.ps_code.localeCompare(b.ps_code))) {
    const level = Number(r.ps_niveau), up = parentCode(r.ps_code, level);
    if (up && !graph.nodes.has(benefitId(up))) throw new Error(`cps: benefit ${r.ps_code} has no parent ${up}`);
    nodeOnce({ id: benefitId(r.ps_code), parent: up ? benefitId(up) : BENEFITS, kind: 'benefit', label: r.ps_lib, short: r.ps_lib, role: 'beneficiary', codes: { ps_code: r.ps_code } });
  }

  const summary = {};
  for (const year of built) {
    const edgeId = (from, to, op) => `${year}:${basis}:${from}>${to}:${op}`;
    const dataProv = r => registry.prov(source, { dataset: DATASET, query: 'exports/json', key: { annee: String(year), ps_code: r.ps_code, si_code: r.si_code, regime_nom: r.regime_nom }, field: 'val' }, { unitIn: 'MEUR' });
    const ofYear = mine.filter(r => Number(r.annee) === year);

    // Resources and the uses other than benefits: the total, split by group.
    let totalIn = 0, totalOut = 0;
    const line = (def, side) => {
      const t = cell(total, def.row, year);
      if (!t || !t.keur) return;
      const other = side === 'in' ? def.from : def.to;
      const ends = hub => (side === 'in' ? { from: other, to: hub } : { from: hub, to: other });
      const opLabel = def.label || def.row;
      const note = t.keur < 0 ? `${opLabel} : montant négatif dans les comptes (${side === 'in' ? 'ressource' : 'emploi'}), représenté dans l’autre sens.` : undefined;
      const root = graph.edge({ id: edgeId(ROOT, other, def.op), ...ends(ROOT), op: def.op, opLabel, year, basis, keur: t.keur, derivation: def.derivation, prov: [t.prov, mappingProv], note });
      if (side === 'in') totalIn += t.keur; else totalOut += t.keur;
      for (const g of Object.keys(MAP.groups)) {
        const c = cell(groups[g], def.row, year);
        if (!c || !c.keur) continue;
        graph.edge({ id: edgeId(`${ROOT}.${g}`, other, def.op), ...ends(`${ROOT}.${g}`), op: def.op, opLabel, year, basis, keur: c.keur, parent: root.id, split: side === 'in' ? 'to' : 'from', derivation: def.derivation, prov: [c.prov, mappingProv] });
      }
    };
    for (const def of MAP.resources) line(def, 'in');
    for (const def of MAP.uses) line(def, 'out');

    // Benefits: the total, by group, sector and régime, then by risk down to each benefit.
    const all = ofYear.find(r => r.si_niveau === '0' && r.ps_niveau === '0');
    const opLabel = 'Prestations de protection sociale';
    const root = graph.edge({ id: edgeId(ROOT, BENEFITS, 'PREST'), from: ROOT, to: BENEFITS, op: 'PREST', opLabel, year, basis, keur: toKeur(all.val, 'MEUR'), derivation: 'direct', prov: [dataProv(all)], note: 'Prestations en espèces et en nature versées aux ménages par l’ensemble des régimes.' });
    totalOut += root.keur;
    const sheetBenefits = MAP.benefitRows.reduce((s, label) => s + ((cell(total, label, year) || {}).keur || 0), 0);
    if (Math.abs(sheetBenefits - root.keur) > 20) throw new Error(`cps ${year}: benefits ${root.keur} in the dataset vs ${sheetBenefits} in the workbook`);
    // A to-split by risk, then by benefit, under an edge to the benefits.
    const descend = (top, fromId, list) => {
      const made = new Map();
      for (const it of list.sort((x, y) => x.level - y.level || x.code.localeCompare(y.code))) {
        if (!it.keur) continue;
        const up = parentCode(it.code, it.level);
        const parent = up ? made.get(up) : top;
        if (!parent) continue;
        made.set(it.code, graph.edge({ id: edgeId(fromId, benefitId(it.code), 'PREST'), from: fromId, to: benefitId(it.code), op: 'PREST', opLabel, year, basis, keur: it.keur, parent: parent.id, split: 'to', derivation: it.derivation, prov: it.prov }));
      }
    };
    descend(root, ROOT, ofYear.filter(r => r.si_niveau === '0' && r.ps_niveau !== '0').map(r => ({ code: r.ps_code, level: Number(r.ps_niveau), keur: toKeur(r.val, 'MEUR'), prov: [dataProv(r)], derivation: 'direct' })));
    for (const g of Object.keys(MAP.groups)) {
      const sectors = ofYear.filter(r => r.si_niveau === '1' && r.ps_niveau === '0' && groupOf[r.si_code] === g);
      if (!sectors.length) continue;
      const keur = sectors.reduce((s, r) => s + toKeur(r.val, 'MEUR'), 0);
      const check = MAP.benefitRows.reduce((s, label) => s + ((cell(groups[g], label, year) || {}).keur || 0), 0);
      if (Math.abs(check - keur) > 20) throw new Error(`cps ${year} ${g}: benefits ${keur} in the dataset vs ${check} in the workbook`);
      const ge = graph.edge({ id: edgeId(`${ROOT}.${g}`, BENEFITS, 'PREST'), from: `${ROOT}.${g}`, to: BENEFITS, op: 'PREST', opLabel, year, basis, keur, parent: root.id, split: 'from', derivation: sectors.length === 1 ? 'direct' : 'sum', prov: sectors.map(dataProv) });
      // The group's benefits by risk: the sum of its sectors.
      const sums = new Map();
      for (const r of ofYear) if (r.si_niveau === '1' && r.ps_niveau !== '0' && groupOf[r.si_code] === g) { const o = sums.get(r.ps_code) || { code: r.ps_code, level: Number(r.ps_niveau), keur: 0, prov: [], derivation: 'sum' }; o.keur += toKeur(r.val, 'MEUR'); o.prov.push(dataProv(r)); sums.set(r.ps_code, o); }
      descend(ge, `${ROOT}.${g}`, Array.from(sums.values()));
      for (const s of sectors) {
        const many = regimesOf.get(s.si_code).size > 1;
        const se = graph.edge({ id: edgeId(sectorId(s.si_code), BENEFITS, 'PREST'), from: sectorId(s.si_code), to: BENEFITS, op: 'PREST', opLabel, year, basis, keur: toKeur(s.val, 'MEUR'), parent: ge.id, split: 'from', derivation: 'direct', prov: [dataProv(s)] });
        const regimes = ofYear.filter(r => r.si_niveau === '2' && r.si_code === s.si_code);
        const leaves = new Map();
        for (const r of regimes.filter(x => x.ps_niveau === '0')) {
          leaves.set(r.regime_nom, many ? graph.edge({ id: edgeId(regimeId(r), BENEFITS, 'PREST'), from: regimeId(r), to: BENEFITS, op: 'PREST', opLabel, year, basis, keur: toKeur(r.val, 'MEUR'), parent: se.id, split: 'from', derivation: 'direct', prov: [dataProv(r)] }) : se);
        }
        // Under the sector and under each régime, the risks and their benefits.
        const items = list => list.filter(x => x.ps_niveau !== '0').map(r => ({ code: r.ps_code, level: Number(r.ps_niveau), keur: toKeur(r.val, 'MEUR'), prov: [dataProv(r)], derivation: 'direct' }));
        descend(se, sectorId(s.si_code), items(ofYear.filter(r => r.si_niveau === '1' && r.si_code === s.si_code)));
        if (many) for (const [name, leaf] of leaves) descend(leaf, leaf.from, items(regimes.filter(r => r.regime_nom === name)));
      }
    }

    // The balance, computed: resources minus uses. Per group it also holds the transfers between régimes.
    const tIn = cell(total, MAP.resourcesTotal, year), tOut = cell(total, MAP.usesTotal, year);
    if (Math.abs(tIn.keur - totalIn) > 50 || Math.abs(tOut.keur - totalOut) > 50) throw new Error(`cps ${year}: lines sum to ${totalIn} / ${totalOut}, the totals say ${tIn.keur} / ${tOut.keur}`);
    const solde = totalIn - totalOut;
    const sLabel = 'Solde : ressources moins emplois (calculé)';
    const sroot = graph.edge({ id: edgeId(ROOT, 'CPS.SOLDE', 'SOLDE'), from: ROOT, to: 'CPS.SOLDE', op: 'SOLDE', opLabel: sLabel, year, basis, keur: solde, derivation: 'residual', prov: [tIn.prov, tOut.prov], note: 'Ressources hors transferts moins emplois hors transferts de l’ensemble des régimes ; positif, les régimes dégagent un excédent.' });
    for (const g of Object.keys(MAP.groups)) {
      const a = cell(groups[g], MAP.resourcesTotal, year), b = cell(groups[g], MAP.usesTotal, year);
      if (!a || !b) continue;
      graph.edge({ id: edgeId(`${ROOT}.${g}`, 'CPS.SOLDE', 'SOLDE'), from: `${ROOT}.${g}`, to: 'CPS.SOLDE', op: 'SOLDE', opLabel: 'Solde hors transferts entre régimes (calculé)', year, basis, keur: a.keur - b.keur, parent: sroot.id, split: 'from', derivation: 'residual', prov: [a.prov, b.prov], note: 'Ressources moins emplois du groupe, hors transferts : l’écart comprend les transferts reçus des autres régimes ou versés à eux, que la source ne publie pas par groupe.' });
    }
    // Controls as the data check reads them: gross flows as drawn (a negative line runs the other way), deficit positive.
    let grossIn = 0, grossOut = 0;
    for (const e of graph.edges.values()) if (e.year === year && e.basis === basis && !e.parent && e.op !== 'SOLDE') { if (e.to === ROOT) grossIn += e.keur; else if (e.from === ROOT) grossOut += e.keur; }
    summary[year] = { in: grossIn, out: grossOut, solde: grossOut - grossIn, benefits: root.keur, resources: totalIn, uses: totalOut };
  }
  return { years: built, summary };
}

module.exports = { buildSocial, readOperations, ROOT, BENEFITS };
