'use strict';

// The macro graph: the public administrations (S13 and its sub-sectors down
// to communes, départements, régions, syndicats, hospitals…) and every flow
// in and out of them in the national accounts, for each year. The Insee
// tables 3.201–3.214 give each sub-sector's expenses and receipts by
// operation; the TEE gives, per operation, which sector pays and which
// receives; Eurostat gives the finer items (wages vs contributions, VAT,
// income taxes of households vs corporations, old-age vs unemployment
// benefits) and the flows with the EU institutions.
//
// Every root edge is one official figure (or a sum of official figures,
// said so in its note). A root can be split by its hub end (`to` for a
// receipt, `from` for an expense) into the sub-sectors, by its counterpart
// end into payer sectors, or by operation; the children of a split sum to
// the parent, a residual "non détaillé" edge making up any gap.
const { toKeur } = require('../lib/units.cjs');

const SUB = { S13: ['S1311', 'S1313', 'S1314'], S1311: ['S13111', 'S13112'], S1313: ['S13131', 'S13132'], S13131: ['S131311', 'S131312', 'S131313', 'S131314'], S1314: ['S13141', 'S13142'] };
const EURO_SECTORS = new Set(['S13', 'S1311', 'S1313', 'S1314']);

const SECTOR_NODES = [
  ['S13', null, 'Administrations publiques', 'Administrations publiques', 'hub'],
  ['S1311', 'S13', 'Administration publique centrale', 'Adm. centrale', 'hub'],
  ['S13111', 'S1311', 'État', 'État', 'hub'],
  ['S13112', 'S1311', "Organismes divers d'administration centrale (opérateurs de l'État)", 'ODAC', 'hub'],
  ['S1313', 'S13', 'Administrations publiques locales', 'Adm. locales', 'hub'],
  ['S13131', 'S1313', 'Collectivités locales', 'Collectivités', 'hub'],
  ['S131311', 'S13131', 'Communes', 'Communes', 'hub'],
  ['S131312', 'S13131', 'Départements', 'Départements', 'hub'],
  ['S131313', 'S13131', 'Régions', 'Régions', 'hub'],
  ['S131314', 'S13131', 'Syndicats de collectivités', 'Syndicats', 'hub'],
  ['S13132', 'S1313', "Organismes divers d'administration locale", 'ODAL', 'hub'],
  ['S1314', 'S13', 'Administrations de sécurité sociale', 'Sécurité sociale', 'hub'],
  ['S13141', 'S1314', "Régimes d'assurance sociale", 'Régimes sociaux', 'hub'],
  ['S13142', 'S1314', 'Organismes dépendant des assurances sociales (hôpitaux publics…)', 'Hôpitaux et ODASS', 'hub'],
  ['S11', null, 'Sociétés non financières (entreprises)', 'Entreprises', 'both'],
  ['S12', null, 'Sociétés financières (banques, assureurs)', 'Sociétés financières', 'both'],
  ['S14', null, 'Ménages', 'Ménages', 'both'],
  ['S15', null, 'Institutions sans but lucratif au service des ménages (associations)', 'Associations', 'both'],
  ['S2', null, 'Reste du monde', 'Reste du monde', 'both'],
  ['S2.EU', 'S2', "Institutions de l'Union européenne", 'Union européenne', 'both'],
];
// Counterparts the accounts do not name as an institutional sector.
const CLASS_NODES = [
  ['PAYEURS', null, 'Payeurs non ventilés par la source (sociétés, ménages, administrations)', 'Payeurs non ventilés', 'payer', { aggregate: true }],
  ['PRODUITS', null, 'Acheteurs de biens et services (impôts sur les produits : TVA, accises…)', 'Acheteurs (TVA, accises…)', 'payer'],
  ['CONTRIB.D91', null, 'Ménages et entreprises redevables des impôts en capital (successions, donations)', 'Successions, donations', 'payer'],
  ['ACHETEURS', null, 'Acheteurs des productions des administrations (ventes, redevances, participations des usagers)', 'Usagers et acheteurs', 'payer'],
  ['PLACEMENTS', null, 'Participations et placements (dividendes, intérêts et loyers reçus)', 'Placements', 'payer'],
  ['DIVERS.IN', null, 'Autres transferts reçus (indemnités, dons, amendes, transferts divers)', 'Transferts divers reçus', 'payer'],
  ['FINANCEMENT', null, "Créanciers : emprunt net (besoin de financement) ou placement de l'excédent", 'Emprunt net', 'both'],
  ['IMPUTE', null, 'Écritures imputées sans flux monétaire (cotisations sociales imputées, production pour compte propre)', 'Écritures imputées', 'both'],
  ['POOL', 'S13', 'Autres administrations publiques (transferts entre administrations, non ventilés)', 'Autres administrations', 'both'],
  ['S14.AGENTS', 'S14', 'Agents publics (rémunérations)', 'Agents publics', 'beneficiary'],
  ['FOURNISSEURS', null, "Fournisseurs de biens et services (achats courants et investissements)", 'Fournisseurs', 'beneficiary'],
  ['CREANCIERS', null, 'Créanciers (intérêts de la dette)', 'Créanciers', 'beneficiary'],
  ['PRODUCTEURS', null, 'Producteurs subventionnés (entreprises, exploitants, associations…)', 'Producteurs subventionnés', 'beneficiary'],
  ['DIVERS.OUT', null, 'Transferts courants divers (ménages, associations, entreprises)', 'Transferts divers versés', 'beneficiary'],
  ['CAPITAL', null, "Bénéficiaires d'aides à l'investissement et autres transferts en capital", 'Aides en capital', 'beneficiary'],
  ['NONRECOUVRE', null, 'Impôts et cotisations dus non recouvrables', 'Non recouvrés', 'beneficiary'],
];

const OPS = {
  P2: 'Consommation intermédiaire (achats de biens et services)',
  D1: 'Rémunération des salariés', D11: 'Salaires et traitements bruts', D121: 'Cotisations sociales effectives à la charge des employeurs', D122: 'Cotisations sociales imputées à la charge des employeurs',
  D2: 'Impôts sur la production et les importations', D21: 'Impôts sur les produits (TVA, accises, droits…)', D211: 'Taxe sur la valeur ajoutée', D29: 'Autres impôts sur la production',
  D3: 'Subventions', D31: 'Subventions sur les produits', D39: 'Autres subventions sur la production',
  D4: 'Revenus de la propriété', D41: 'Intérêts', D4X: 'Revenus de la propriété autres que les intérêts',
  D5: 'Impôts courants sur le revenu et le patrimoine', D51A: 'Impôts sur le revenu des personnes (IR, CSG, CRDS…)', D51B: 'Impôts sur les bénéfices des sociétés', D59: 'Autres impôts courants',
  D61: 'Cotisations sociales nettes', D611: 'Cotisations sociales effectives à la charge des employeurs', D612: 'Cotisations sociales imputées', D613: 'Cotisations sociales effectives à la charge des ménages',
  D62: 'Prestations sociales en espèces', D632: 'Transferts sociaux en nature de produits marchands (remboursements de soins…)',
  D73: 'Transferts courants entre administrations publiques', D733: 'Transferts de recettes fiscales', D7X: 'Autres transferts courants',
  D71: "Primes nettes d'assurance-dommages", D74: 'Coopération internationale courante', D75: 'Transferts courants divers', D76: "Ressources propres de l'Union européenne (TVA et RNB)",
  D9: 'Transferts en capital', D91: 'Impôts en capital', D995: 'Impôts et cotisations dus non recouvrables',
  P11: 'Ventes et production marchande', P12: 'Production pour emploi final propre', P131: 'Paiements partiels des usagers',
  P51G: 'Formation brute de capital fixe (investissement)', P5X: "Autres acquisitions d'actifs non financiers",
  B9: 'Capacité (+) ou besoin (−) de financement',
  GF1002: 'Vieillesse', GF1003: 'Survie', GF1005: 'Chômage',
};

const COFOG_FR = { GF01: 'Services publics généraux', GF0101: 'Organes exécutifs et législatifs, affaires financières et fiscales', GF0102: 'Aide économique extérieure', GF0103: 'Services généraux', GF0104: 'Recherche fondamentale', GF0105: 'R&D services publics généraux', GF0106: 'Services publics généraux n.c.a.', GF0107: 'Opérations concernant la dette publique', GF0108: 'Transferts entre administrations', GF02: 'Défense', GF0201: 'Défense militaire', GF0202: 'Défense civile', GF0203: 'Aide militaire extérieure', GF0204: 'R&D défense', GF0205: 'Défense n.c.a.', GF03: 'Ordre et sécurité publics', GF0301: 'Services de police', GF0302: 'Services de protection civile (incendie)', GF0303: 'Tribunaux', GF0304: 'Administration pénitentiaire', GF0305: 'R&D ordre et sécurité', GF0306: 'Ordre et sécurité n.c.a.', GF04: 'Affaires économiques', GF0401: 'Tutelle de l’économie générale, du commerce et de l’emploi', GF0402: 'Agriculture, sylviculture, pêche et chasse', GF0403: 'Combustibles et énergie', GF0404: 'Industries extractives et manufacturières, construction', GF0405: 'Transports', GF0406: 'Communications', GF0407: 'Autres branches d’activité', GF0408: 'R&D affaires économiques', GF0409: 'Affaires économiques n.c.a.', GF05: 'Protection de l’environnement', GF0501: 'Gestion des déchets', GF0502: 'Gestion des eaux usées', GF0503: 'Lutte contre la pollution', GF0504: 'Protection de la biodiversité et des paysages', GF0505: 'R&D environnement', GF0506: 'Environnement n.c.a.', GF06: 'Logement et équipements collectifs', GF0601: 'Logement', GF0602: 'Équipements collectifs', GF0603: 'Alimentation en eau', GF0604: 'Éclairage public', GF0605: 'R&D logement', GF0606: 'Logement n.c.a.', GF07: 'Santé', GF0701: 'Produits, appareils et matériels médicaux', GF0702: 'Services ambulatoires', GF0703: 'Services hospitaliers', GF0704: 'Services de santé publique', GF0705: 'R&D santé', GF0706: 'Santé n.c.a.', GF08: 'Loisirs, culture et culte', GF0801: 'Services récréatifs et sportifs', GF0802: 'Services culturels', GF0803: 'Services de radiodiffusion, de télévision et d’édition', GF0804: 'Cultes et autres services communautaires', GF0805: 'R&D loisirs et culture', GF0806: 'Loisirs et culture n.c.a.', GF09: 'Enseignement', GF0901: 'Enseignement préélémentaire et primaire', GF0902: 'Enseignement secondaire', GF0903: 'Enseignement postsecondaire non supérieur', GF0904: 'Enseignement supérieur', GF0905: 'Enseignement non défini par niveau', GF0906: 'Services annexes à l’enseignement', GF0907: 'R&D enseignement', GF0908: 'Enseignement n.c.a.', GF10: 'Protection sociale', GF1001: 'Maladie et invalidité', GF1002: 'Vieillesse', GF1003: 'Survie', GF1004: 'Famille et enfants', GF1005: 'Chômage', GF1006: 'Logement', GF1007: 'Exclusion sociale n.c.a.', GF1008: 'R&D protection sociale', GF1009: 'Protection sociale n.c.a.' };

// What the spending is for (Eurostat COFOG) and what the benefits are for
// (DREES risks), kept on each sub-sector node as details of its own.
function annotate({ graph, registry, cofog, cps, years }) {
  const src = (s, item, year, gf) => registry.prov('eurostat-cofog', { table: 'gov_10a_exp', geo: 'FR', unit: 'MIO_EUR', sector: s, na_item: item, cofog99: gf, time: String(year) }, { unitIn: 'MEUR' });
  const sectors = ['S13', 'S1311', 'S1313', 'S1314'];
  for (const s of sectors) {
    const node = graph.nodes.get(s); if (!node) continue;
    node.functions = {};
    for (const y of years) {
      const list = [];
      for (const r of (cofog.records || [])) {
        if (r.dims.sector !== s || r.dims.time !== String(y) || !r.dims.cofog99 || r.dims.cofog99 === 'TOTAL') continue;
        if (r.value === null || r.value === undefined) continue;
        list.push({ code: r.dims.cofog99, label: COFOG_FR[r.dims.cofog99] || r.labels.cofog99, keur: toKeur(r.value, 'MEUR'), prov: src(s, 'TE', y, r.dims.cofog99), level: r.dims.cofog99.length === 4 ? 1 : 2 });
      }
      const total = (cofog.records || []).find(r => r.dims.sector === s && r.dims.time === String(y) && r.dims.cofog99 === 'TOTAL');
      if (list.length) node.functions[`${y}/sna`] = { total: total ? toKeur(total.value, 'MEUR') : null, totalProv: total ? src(s, 'TE', y, 'TOTAL') : null, items: list.sort((a, b) => (a.code < b.code ? -1 : 1)) };
    }
  }
  // DREES: benefits by risk for the État, ODAC, APUL, régime général (S13141) and other social bodies (S13142).
  const dsrc = (year, ps, si) => registry.prov('drees-cps', { dataset: '305_les-comptes-de-la-protection-sociale', query: "group_by annee,ps_code,si_code (si_niveau 1, ps_niveau 0-1)", key: { annee: String(year), ps_code: ps, si_code: si }, field: 'val' }, { unitIn: 'MEUR' });
  const byNode = new Map();
  for (const r of cps || []) {
    const node = graph.nodes.get(r.si_code); if (!node) continue;
    const y = Number(r.annee); if (!years.includes(y)) continue;
    if (!byNode.has(r.si_code)) byNode.set(r.si_code, {});
    const bucket = byNode.get(r.si_code);
    const key = `${y}/sna`;
    if (!bucket[key]) bucket[key] = { total: null, items: [] };
    if (r.ps_niveau === '0') { bucket[key].total = toKeur(r.val, 'MEUR'); bucket[key].totalProv = dsrc(y, r.ps_code, r.si_code); }
    else bucket[key].items.push({ code: r.ps_code, label: r.ps_lib, keur: toKeur(r.val, 'MEUR'), prov: dsrc(y, r.ps_code, r.si_code) });
  }
  for (const [id, b] of byNode) { const node = graph.nodes.get(id); node.benefits = b; for (const v of Object.values(b)) v.items.sort((a, b2) => (a.code < b2.code ? -1 : 1)); }
}

function buildMacro({ graph, registry, apu, tee, euro, years, cofog, cps }) {
  const sourceCell = (table, item, year) => registry.prov('insee-apu', { table, sheet: apu[table].sheet, cell: apu[table].items[item][year].cell, row: apu[table].items[item].label, year }, { unitIn: 'MDEUR' });
  const sourceTee = (year, op, side, col) => registry.prov('insee-tee', { file: `TEE_${year}_fr.xlsx`, sheet: 'TEE_COMPLET', cell: tee[year].ops[op][side][col].cell, op, side, sector: col }, { unitIn: 'MDEUR' });
  const sourceEuro = (sector, item, year) => registry.prov('eurostat-gov', { table: 'gov_10a_main', geo: 'FR', unit: 'MIO_EUR', sector, na_item: item, time: String(year) }, { unitIn: 'MEUR' });
  const tableOf = {};
  for (const [t, p] of Object.entries(apu)) tableOf[p.sector] = Number(t);

  // Node tree.
  for (const [id, parent, label, short, role] of SECTOR_NODES) graph.node({ id, parent, kind: 'sector', label, short, role, codes: { esa: id === 'S2.EU' ? 'S212' : id } });
  for (const [id, parent, label, short, role, extra] of CLASS_NODES) graph.node({ id, parent, kind: 'class', label, short, role, ...(extra || {}) });

  // One official figure: Insee cell, TEE cell or Eurostat value, in k€ with its provenance.
  const insee = (sector, item, year) => {
    const t = tableOf[sector];
    if (!t || !apu[t].items[item] || !apu[t].items[item][year] || apu[t].items[item][year].value === null) return null;
    return { keur: toKeur(apu[t].items[item][year].value, 'MDEUR'), prov: sourceCell(t, item, year) };
  };
  const teeFig = (year, op, side, col) => {
    const c = tee[year] && tee[year].ops[op] && tee[year].ops[op][side][col];
    if (!c) return null;
    return { keur: toKeur(c.value, 'MDEUR'), prov: sourceTee(year, op, side, col) };
  };
  const eu = (sector, item, year) => {
    const r = euro.get(sector, item, year);
    if (!r || r.value === null || r.value === undefined) return null;
    return { keur: toKeur(r.value, 'MEUR'), prov: sourceEuro(sector, item, year), status: r.status };
  };

  const ids = new Set();
  const edge = (def) => {
    const id = def.id || `${def.year}:sna:${def.from}>${def.to}:${def.op}`;
    if (ids.has(id)) throw new Error(`edge id ${id} twice`);
    ids.add(id);
    return graph.edge({ ...def, id, opLabel: def.opLabel || OPS[def.op] || def.op, basis: 'sna' });
  };
  const child = (parent, split, def) => { const op = def.op || parent.op; return edge({ ...def, id: `${parent.id}|${split}:${def.from}>${def.to}:${op}`, parent: parent.id, split, year: parent.year, op }); };

  // Split an edge by the hub end down the sub-sector tree, reading the same Insee item in each table.
  const splitHub = (parent, side, item, year, { consolidated = false, opts = {} } = {}) => {
    const hub = side === 'from' ? parent.from : parent.to;
    const kids = SUB[hub];
    if (!kids) return;
    const made = [];
    for (const k of kids) {
      const f = insee(k, item, year);
      if (!f) continue;
      const def = { [side]: k, [side === 'from' ? 'to' : 'from']: side === 'from' ? parent.to : parent.from, keur: f.keur, prov: [f.prov], derivation: 'direct', flags: [...(parent.flags || []).filter(x => x !== 'residual')], ...opts };
      made.push(child(parent, side, def));
    }
    if (consolidated && made.length) {
      const sum = made.reduce((s, e) => s + e.keur, 0);
      if (sum > parent.keur) parent.consolidated = sum - parent.keur;
    }
    for (const m of made) splitHub(m, side, item, year, { consolidated, opts });
  };

  for (const year of years) {
    const Y = year;
    const F = (s, i) => insee(s, i, Y);
    const E = (s, i) => eu(s, i, Y);
    const T = (op, side, col) => teeFig(Y, op, side, col);
    const have = (...xs) => xs.every(Boolean);
    const sum = (...xs) => xs.reduce((s, x) => s + x.keur, 0);
    const provs = (...xs) => xs.map(x => x.prov);

    void 0;
    // ---- Expenses of S13 (out-edges) ----
    const out = (op, to, item, { consolidated = false, note, flags = [] } = {}) => {
      const f = F('S13', item); if (!f) return null;
      const e = edge({ year: Y, from: 'S13', to, op, keur: f.keur, prov: [f.prov], derivation: 'direct', note, flags });
      splitHub(e, 'from', item, Y, { consolidated });
      return e;
    };
    const p2 = out('P2', 'FOURNISSEURS', 'P2');
    const d1 = out('D1', 'S14.AGENTS', 'D1PAY', { note: 'Rémunération des agents publics, cotisations sociales employeur comprises (dont des cotisations imputées, qui ne sont pas un flux monétaire).' });
    // D1 by operation: wages (Eurostat), actual employer contributions (difference), imputed contributions (Insee).
    const splitD1 = (e, sector) => {
      const w = EURO_SECTORS.has(sector) ? E(sector, 'D11PAY') : null;
      const imp = F(sector, 'D122PAY');
      if (!have(w, imp)) return;
      child(e, 'op', { op: 'D11', from: e.from, to: e.to, keur: w.keur, prov: [w.prov], derivation: 'direct' });
      const actual = e.keur - w.keur - imp.keur;
      if (actual >= 0) child(e, 'op', { op: 'D121', from: e.from, to: e.to, keur: actual, prov: [w.prov, imp.prov, ...e.prov], derivation: 'sum', note: 'D1 − D11 − D122 : cotisations effectives à la charge des employeurs publics, reversées aux régimes sociaux.' });
      child(e, 'op', { op: 'D122', from: e.from, to: e.to, keur: imp.keur, prov: [imp.prov], derivation: 'direct', flags: ['imputed'], note: 'Cotisations imputées : contrepartie comptable des pensions versées directement par les administrations à leurs anciens agents, sans flux monétaire.' });
    };
    if (d1) { splitD1(d1, 'S13'); for (const k of graph.kids(d1.id, 'from')) splitD1(k, k.from); }
    out('D29', 'POOL', 'D29PAY', { note: 'Impôts sur la production payés par des administrations à d’autres administrations (taxe foncière des hôpitaux, par exemple).' });
    out('D5', 'POOL', 'D5PAY', { note: 'Impôts courants payés par des administrations à d’autres administrations.' });
    out('D4X', 'DIVERS.OUT', 'D4XD41PAY');
    out('D41', 'CREANCIERS', 'D41PAY', { consolidated: true, note: 'Intérêts versés sur la dette. Le chiffre des administrations publiques est consolidé : les intérêts qu’une administration verse à une autre en sont retirés.' });
    const d62 = out('D62', 'S14', 'D62PAY', { note: 'Pensions, allocations, indemnités versées en espèces. Une petite part va à des non-résidents (au plus 9,6 Md€ toutes administrations et entreprises confondues en 2024 d’après le TEE).' });
    // D62 by function (old age, survivors, unemployment) from Eurostat, the rest as residual.
    const splitD62 = (e, sector) => {
      if (!EURO_SECTORS.has(sector)) return;
      for (const gf of ['GF1002', 'GF1003', 'GF1005']) { const v = E(sector, `D62PAY_${gf}`); if (v) child(e, 'op', { op: gf, opLabel: `Prestations : ${OPS[gf].toLowerCase()}`, from: e.from, to: e.to, keur: v.keur, prov: [v.prov], derivation: 'direct' }); }
    };
    if (d62) { splitD62(d62, 'S13'); for (const k of graph.kids(d62.id, 'from')) splitD62(k, k.from); }
    out('D632', 'S14', 'D632PAY', { note: 'Soins, médicaments et services marchands pris en charge pour les ménages.' });
    const d3 = out('D3', 'PRODUCTEURS', 'D3PAY');
    const splitD3 = (e, sector) => {
      if (!EURO_SECTORS.has(sector)) return;
      const a = E(sector, 'D31PAY'), b = E(sector, 'D39PAY');
      if (!have(a, b)) return;
      child(e, 'op', { op: 'D31', from: e.from, to: 'PRODUITS', keur: a.keur, prov: [a.prov], derivation: 'direct', note: 'Subventions sur les produits : elles abaissent le prix payé par les acheteurs.' });
      child(e, 'op', { op: 'D39', from: e.from, to: 'PRODUCTEURS', keur: b.keur, prov: [b.prov], derivation: 'direct' });
    };
    if (d3) { splitD3(d3, 'S13'); for (const k of graph.kids(d3.id, 'from')) splitD3(k, k.from); }
    const d7 = out('D7X', 'DIVERS.OUT', 'D7XD73PAY');
    const splitD7 = (e, sector) => {
      if (!EURO_SECTORS.has(sector)) return;
      const d71 = E(sector, 'D71PAY'), d72 = E(sector, 'D72PAY'), d74 = E(sector, 'D74PAY'), d75 = E(sector, 'D75PAY'), d76 = E(sector, 'D76PAY'), d74eu = E(sector, 'D74PAY_S212');
      if (!have(d71, d74, d75, d76)) return;
      if (d72 && d72.keur) child(e, 'op', { op: 'D72', opLabel: "Indemnités d'assurance-dommages versées", from: e.from, to: 'DIVERS.OUT', keur: d72.keur, prov: [d72.prov], derivation: 'direct' });
      child(e, 'op', { op: 'D71', from: e.from, to: 'S12', keur: d71.keur, prov: [d71.prov], derivation: 'single-counterpart', note: 'Primes d’assurance-dommages, versées aux assureurs.' });
      const c74 = child(e, 'op', { op: 'D74', from: e.from, to: 'S2', keur: d74.keur, prov: [d74.prov], derivation: 'single-counterpart', note: 'Coopération internationale courante (aide publique au développement, contributions aux organisations internationales).' });
      if (d74eu) child(c74, 'to', { from: e.from, to: 'S2.EU', keur: d74eu.keur, prov: [d74eu.prov], derivation: 'direct' });
      child(e, 'op', { op: 'D75', from: e.from, to: 'DIVERS.OUT', keur: d75.keur, prov: [d75.prov], derivation: 'widened' });
      child(e, 'op', { op: 'D76', from: e.from, to: 'S2.EU', keur: d76.keur, prov: [d76.prov], derivation: 'single-counterpart', note: 'Contribution au budget de l’Union européenne assise sur la TVA et le revenu national brut.' });
    };
    if (d7) { splitD7(d7, 'S13'); for (const k of graph.kids(d7.id, 'from')) splitD7(k, k.from); }
    const d9 = out('D9', 'CAPITAL', 'D9XPAY', { consolidated: true, note: 'Aides à l’investissement et autres transferts en capital (hors impôts non recouvrables). Consolidé : les transferts entre administrations en sont retirés.' });
    const splitD9 = (e, sector) => {
      if (!EURO_SECTORS.has(sector)) return;
      const s2 = E(sector, 'D9PAY_S2');
      if (s2 && s2.keur > 0) child(e, 'to', { from: e.from, to: 'S2', keur: s2.keur, prov: [s2.prov], derivation: 'direct' });
    };
    if (d9) { splitD9(d9, 'S13'); for (const k of graph.kids(d9.id, 'from')) splitD9(k, k.from); }
    const p51 = F('S13', 'P51GPAY'), own = F('S13', 'P12PAY');
    if (have(p51, own)) {
      const e = edge({ year: Y, from: 'S13', to: 'FOURNISSEURS', op: 'P51G', keur: p51.keur - own.keur, prov: provs(p51, own), derivation: 'sum', note: 'Investissement (P51g) moins la part produite par les administrations elles-mêmes (P12), qui n’est pas un achat.' });
      for (const k of SUB.S13) { const a = F(k, 'P51GPAY'), b = F(k, 'P12PAY'); if (have(a, b)) { const c = child(e, 'from', { from: k, to: e.to, keur: a.keur - b.keur, prov: provs(a, b), derivation: 'sum' }); for (const kk of SUB[k] || []) { const aa = F(kk, 'P51GPAY'), bb = F(kk, 'P12PAY'); if (have(aa, bb)) { const cc = child(c, 'from', { from: kk, to: e.to, keur: aa.keur - bb.keur, prov: provs(aa, bb), derivation: 'sum' }); for (const k3 of SUB[kk] || []) { const a3 = F(k3, 'P51GPAY'), b3 = F(k3, 'P12PAY'); if (have(a3, b3)) child(cc, 'from', { from: k3, to: e.to, keur: a3.keur - b3.keur, prov: provs(a3, b3), derivation: 'sum' }); } } } } }
      const i = edge({ year: Y, from: 'S13', to: 'IMPUTE', op: 'P12', keur: own.keur, prov: [own.prov], derivation: 'direct', flags: ['imputed'], note: 'Investissement produit par les administrations pour elles-mêmes (logiciels, recherche…) : compté en dépense et en recette, sans flux monétaire.' });
      splitHub(i, 'from', 'P12PAY', Y, { opts: { flags: ['imputed'] } });
    }
    out('P5X', 'FOURNISSEURS', 'P5XNPPAY');
    // Transfers between administrations: each sub-sector's payments go to the pool, the pool pays each sub-sector's receipts.
    const pool = (sector, item, dir, op, note) => {
      const f = F(sector, item); if (!f || f.keur === 0) return null;
      const def = dir === 'pay' ? { from: sector, to: 'POOL' } : { from: 'POOL', to: sector };
      return edge({ year: Y, ...def, op, keur: f.keur, prov: [f.prov], derivation: 'direct', flags: ['intra'], note });
    };
    const poolTree = (sector, item, dir, op, note) => { for (const k of SUB[sector] || []) { pool(k, item, dir, op, note); poolTree(k, item, dir, op, note); } };
    poolTree('S13', 'D73PAY', 'pay', 'D73', 'Transferts courants versés à d’autres administrations publiques (dotations de l’État aux collectivités, financements de la sécurité sociale…).');
    poolTree('S13', 'D73XREC', 'rec', 'D73', 'Transferts courants reçus d’autres administrations publiques.');
    for (const k of Object.keys(tableOf)) if (k !== 'S13') { const f = F(k, 'D733REC'); if (f && f.keur !== 0) edge({ year: Y, from: 'POOL', to: k, op: 'D733', keur: f.keur, prov: [f.prov], derivation: 'direct', flags: ['intra'], note: 'Recettes fiscales transférées entre administrations (fractions de TVA et autres impôts partagés) ; négatif pour celle qui les cède.' }); }
    const nonrec = F('S13', 'D995REC');
    if (nonrec) { const e = edge({ year: Y, from: 'NONRECOUVRE', to: 'S13', op: 'D995', keur: nonrec.keur, prov: [nonrec.prov], derivation: 'direct', note: 'Impôts et cotisations constatés mais jugés non recouvrables : comptés en recette négative.' }); splitHub(e, 'to', 'D995REC', Y); }

    // ---- Receipts of S13 (in-edges) ----
    const inn = (op, from, item, { consolidated = false, note, flags = [], derivation = 'direct' } = {}) => {
      const f = F('S13', item); if (!f) return null;
      const e = edge({ year: Y, from, to: 'S13', op, keur: f.keur, prov: [f.prov], derivation, note, flags });
      splitHub(e, 'to', item, Y, { consolidated });
      return e;
    };
    // Taxes on production and imports: the Insee table gives the receipt of
    // each sub-sector; the TEE gives who pays (sectors for D29, the buyers
    // of products for D21). The TEE total can differ a little from the
    // Insee table for years the TEE was published earlier, so the payer
    // split hangs from a root of its own (`alt: 'tee'`), the site showing
    // one or the other and saying so.
    const d2 = inn('D2', 'PAYEURS', 'D2REC', { derivation: 'widened' });
    const teeRoot = (op, note) => {
      const t = T(op, 'ressources', 'S13'); if (!t) return null;
      return edge({ id: `${Y}:sna:PAYEURS>S13:${op}:tee`, year: Y, from: 'PAYEURS', to: 'S13', op, keur: t.keur, prov: [t.prov], derivation: 'widened', alt: 'tee', note });
    };
    const payers = [['S11', 'S11'], ['S12', 'S12'], ['S14', 'S14'], ['S15', 'S15'], ['S13', 'POOL'], ['S2', 'S2']];
    const d2tee = teeRoot('D2', "Répartition par payeur d'après le tableau économique d'ensemble.");
    if (d2tee) {
      // D29 by payer sector when every euro of it reaches S13; when a part
      // goes to the rest of the world (years before 2024), the payer split
      // of S13's share is unknown and the sectors are only listed as detail.
      const d29s2 = T('D29', 'ressources', 'S2'), d29s13 = T('D29', 'ressources', 'S13');
      const shares = payers.map(([col, node]) => [node, T('D29', 'emplois', col)]).filter(([, t]) => t && t.keur);
      if (d29s13 && (!d29s2 || d29s2.keur === 0)) {
        for (const [node, t] of shares) child(d2tee, 'from', { op: 'D29', from: node, to: 'S13', keur: t.keur, prov: [t.prov], derivation: 'single-counterpart', note: node === 'POOL' ? 'Impôts sur la production payés par des administrations publiques.' : undefined });
      } else if (d29s13) {
        child(d2tee, 'from', { op: 'D29', from: 'PAYEURS', to: 'S13', keur: d29s13.keur, prov: [d29s13.prov, d29s2.prov], derivation: 'widened', note: `Autres impôts sur la production reçus par les administrations ; ${(d29s2.keur / 1e6).toFixed(1).replace('.', ',')} Md€ de ces impôts vont au reste du monde cette année-là, si bien que la part payée par chaque secteur n'est connue que pour l'ensemble.`, detail: shares.map(([node, t]) => ({ node, keur: t.keur, prov: t.prov })) });
      }
      const d21 = T('D21', 'ressources', 'S13'); if (d21) child(d2tee, 'from', { op: 'D21', from: 'PRODUITS', to: 'S13', keur: d21.keur, prov: [d21.prov], derivation: 'single-counterpart', note: 'Les impôts sur les produits (TVA, accises, droits de mutation…) sont payés par les acheteurs de biens et services ; la comptabilité nationale ne les ventile pas par secteur.' });
    }
    if (d2) {
      for (const e of [d2, ...graph.kids(d2.id, 'to')]) {
        const s = e.to; if (!EURO_SECTORS.has(s)) continue;
        const a = E(s, 'D211REC'), b = E(s, 'D21REC'), c = E(s, 'D29REC');
        if (!have(a, b, c)) continue;
        child(e, 'op', { op: 'D211', from: 'PRODUITS', to: s, keur: a.keur, prov: [a.prov], derivation: 'single-counterpart' });
        child(e, 'op', { op: 'D21', opLabel: 'Autres impôts sur les produits (accises, droits de mutation, taxes sur les assurances…)', from: 'PRODUITS', to: s, keur: b.keur - a.keur, prov: [a.prov, b.prov], derivation: 'sum', note: 'D21 − D211.' });
        child(e, 'op', { op: 'D29', from: 'PAYEURS', to: s, keur: c.keur, prov: [c.prov], derivation: 'widened' });
      }
    }
    const d5 = inn('D5', 'PAYEURS', 'D5REC', { derivation: 'widened' });
    const d5tee = teeRoot('D5', "Répartition par payeur d'après le tableau économique d'ensemble.");
    if (d5tee) for (const [col, node] of payers) { const t = T('D5', 'emplois', col); if (t && t.keur) child(d5tee, 'from', { from: node, to: 'S13', keur: t.keur, prov: [t.prov], derivation: 'single-counterpart' }); }
    if (d5) {
      for (const e of [d5, ...graph.kids(d5.id, 'to')]) {
        const s = e.to; if (!EURO_SECTORS.has(s)) continue;
        const a = E(s, 'D51A_C1REC'), b = E(s, 'D51B_C2REC'), c = E(s, 'D59REC');
        if (!have(a, b, c)) continue;
        child(e, 'op', { op: 'D51A', from: 'S14', to: s, keur: a.keur, prov: [a.prov], derivation: 'single-counterpart', note: 'Impôt sur le revenu, CSG, CRDS, prélèvements sur les revenus du capital des personnes.' });
        child(e, 'op', { op: 'D51B', from: 'S11', to: s, keur: b.keur, prov: [b.prov], derivation: 'widened', note: 'Impôt sur les sociétés et prélèvements assimilés, payés par les sociétés financières et non financières.' });
        child(e, 'op', { op: 'D59', from: 'PAYEURS', to: s, keur: c.keur, prov: [c.prov], derivation: 'widened', note: 'Taxe d’habitation, redevance audiovisuelle, impôt sur la fortune immobilière et autres impôts courants.' });
      }
    }
    const d61 = inn('D61', 'S14', 'D61REC', { note: 'Cotisations sociales, y compris la part employeur, que la comptabilité nationale fait transiter par les ménages ; une part au plus de 0,4 Md€ vient de non-résidents (TEE 2024).' });
    if (d61) for (const e of [d61, ...graph.kids(d61.id, 'to')]) {
      const s = e.to; if (!EURO_SECTORS.has(s)) continue;
      const a = E(s, 'D611REC'), b = E(s, 'D613REC'), imp = F(s, 'D612REC');
      if (!have(a, b, imp)) continue;
      child(e, 'op', { op: 'D611', from: 'S14', to: s, keur: a.keur, prov: [a.prov], derivation: 'direct', note: 'Part employeur, versée par les employeurs pour le compte des salariés.' });
      child(e, 'op', { op: 'D613', from: 'S14', to: s, keur: b.keur, prov: [b.prov], derivation: 'direct', note: 'Part salariale et cotisations des indépendants.' });
      child(e, 'op', { op: 'D612', from: 'IMPUTE', to: s, keur: imp.keur, prov: [imp.prov], derivation: 'direct', flags: ['imputed'] });
    }
    inn('D91', 'CONTRIB.D91', 'D91REC', { derivation: 'widened' });
    inn('P11', 'ACHETEURS', 'P11REC', { derivation: 'widened' });
    inn('P131', 'ACHETEURS', 'P131REC', { derivation: 'widened' });
    inn('P12', 'IMPUTE', 'P12REC', { flags: ['imputed'] });
    inn('D39', 'POOL', 'D39REC', { note: 'Subventions reçues d’autres administrations.' });
    inn('D41', 'PLACEMENTS', 'D41REC', { consolidated: true, derivation: 'widened' });
    inn('D4X', 'PLACEMENTS', 'D4XD41REC', { derivation: 'widened' });
    const d7r = inn('D7X', 'DIVERS.IN', 'D7XD73REC', { derivation: 'widened' });
    if (d7r) for (const e of [d7r, ...graph.kids(d7r.id, 'to')]) {
      const s = e.to; if (!EURO_SECTORS.has(s)) continue;
      const eu7 = E(s, 'D7REC_S212'), d72 = E(s, 'D72REC');
      if (eu7 && eu7.keur) child(e, 'from', { from: 'S2.EU', to: s, keur: eu7.keur, prov: [eu7.prov], derivation: 'direct', note: 'Transferts courants reçus des institutions européennes.' });
      if (d72 && d72.keur) child(e, 'from', { from: 'S12', to: s, keur: d72.keur, prov: [d72.prov], derivation: 'single-counterpart', note: 'Indemnités d’assurance-dommages.' });
    }
    const d9r = inn('D9', 'CAPITAL', 'D9XREC', { consolidated: true, derivation: 'widened', note: 'Transferts en capital reçus (hors impôts en capital et non recouvrables). Consolidé.' });
    if (d9r) for (const e of [d9r, ...graph.kids(d9r.id, 'to')]) {
      const s = e.to; if (!EURO_SECTORS.has(s)) continue;
      const eu9 = E(s, 'D9REC_S212');
      if (eu9 && eu9.keur > 0 && eu9.keur <= e.keur) child(e, 'from', { from: 'S2.EU', to: s, keur: eu9.keur, prov: [eu9.prov], derivation: 'direct', note: 'Fonds européens (FEDER, FEADER, FSE…).' });
    }
    // Financing: the deficit is borrowed, a surplus is placed.
    const b9 = F('S13', 'B9');
    if (b9) {
      const e = edge({ year: Y, from: 'FINANCEMENT', to: 'S13', op: 'B9', keur: -b9.keur, prov: [b9.prov], derivation: 'direct', note: 'Besoin de financement : ce que les administrations empruntent en net dans l’année (déficit public au sens de Maastricht).' });
      const rec = (parent, hub) => { for (const k of SUB[hub] || []) { const f = F(k, 'B9'); if (!f) continue; const c = child(parent, parent.to === hub ? 'to' : 'from', { from: 'FINANCEMENT', to: k, keur: -f.keur, prov: [f.prov], derivation: 'direct' }); rec(c, k); } };
      rec(e, 'S13');
    }
  }
  if (cofog || cps) annotate({ graph, registry, cofog, cps, years });
}

module.exports = { buildMacro, SUB, SECTOR_NODES, CLASS_NODES, OPS };
