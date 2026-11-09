'use strict';

// The State budget as voted: the general budget's credits by mission,
// programme, action and sous-action (the PLF dataset by destination and
// nature), each line going to the class of beneficiary its titre and
// catégorie name; the receipts by tax and the prélèvements sur recettes
// from the Voies et moyens annex; the balance as a computed residual.
// Basis `budget-plf` for the bill's year. The mission "Remboursements et
// dégrèvements" is left out because the receipts are taken net of it.
const { toKeur } = require('../lib/units.cjs');
const TITRES = require('../mappings/titres.json');

const STATE = 'S13111';
const RD = 'RD';

const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

function buildBudget({ graph, registry, year, rows, vm, source, vmSource }) {
  const basis = 'budget-plf';
  const prov = (locator, extra) => registry.prov(source, locator, extra);
  const provVm = (row, col) => registry.prov(vmSource, { file: vm.file, page: row.page, line: row.line, row: row.label, column: col }, { unitIn: row.unit });
  const nodeOnce = def => (graph.nodes.has(def.id) ? graph.nodes.get(def.id) : graph.node(def));

  // Beneficiary classes of the budget that the macro graph does not have.
  for (const [id, c] of Object.entries(TITRES.classes)) nodeOnce({ id, kind: 'class', label: c.label, short: c.short, role: 'beneficiary' });
  const mappingProv = prov({ file: 'flux-pipeline/mappings/titres.json', key: 'categories' }, { note: 'Correspondance catégorie de dépense → classe de bénéficiaire.' });

  // The tree: missions, programmes, actions, sous-actions of the general budget.
  const bg = rows.filter(r => r.type_mission === 'BG' && r.code_mission !== RD);
  const idOf = {
    mission: r => `${STATE}.M.${r.code_mission}`,
    programme: r => `${STATE}.M.${r.code_mission}.P${r.programme}`,
    action: r => `${STATE}.M.${r.code_mission}.P${r.programme}.A${r.action}`,
    sousAction: r => `${STATE}.M.${r.code_mission}.P${r.programme}.A${r.action}.S${r.sous_action}`,
  };
  const ranks = new Map();
  const rank = (parent, key) => { const m = ranks.get(parent) || new Map(); if (!m.has(key)) m.set(key, m.size); ranks.set(parent, m); return m.get(key); };
  for (const r of bg) {
    nodeOnce({ id: idOf.mission(r), parent: STATE, kind: 'budget', label: `Mission ${r.mission}`, short: r.mission, role: 'hub', codes: { mission: r.code_mission }, rank: rank(STATE, r.code_mission) });
    nodeOnce({ id: idOf.programme(r), parent: idOf.mission(r), kind: 'budget', label: `Programme ${r.programme} – ${r.libelle_programme}`, short: `${r.programme} ${r.libelle_programme}`, role: 'hub', codes: { programme: String(r.programme) }, rank: rank(idOf.mission(r), r.programme) });
    nodeOnce({ id: idOf.action(r), parent: idOf.programme(r), kind: 'budget', label: `Action ${r.action} – ${r.libelle_action}`, short: `${r.action} ${r.libelle_action}`, role: 'hub', codes: { action: String(r.action) }, rank: rank(idOf.programme(r), r.action) });
    if (r.sous_action !== null && r.sous_action !== undefined && r.sous_action !== '') nodeOnce({ id: idOf.sousAction(r), parent: idOf.action(r), kind: 'budget', label: `Sous-action ${r.sous_action} – ${r.libelle_sousaction}`, short: `${r.sous_action} ${r.libelle_sousaction}`, role: 'hub', rank: rank(idOf.action(r), r.sous_action) });
  }

  // Expenses: one root per (beneficiary class, catégorie) summing the general
  // budget, split by mission, programme, action, sous-action.
  const classOf = r => { const c = TITRES.categories[String(r.categorie)]; if (!c) throw new Error(`catégorie ${r.categorie} unknown (titre ${r.code_titre})`); return c; };
  const sumBy = (list, keyFn) => { const m = new Map(); for (const r of list) { const k = keyFn(r); const o = m.get(k) || { keur: 0, rows: [] }; o.keur += toKeur(r.cp_plf, 'EUR'); o.rows.push(r); m.set(k, o); } return m; };
  const rowProv = r => prov({ dataset: 'plf25-depenses-2025-du-bg-et-des-ba-selon-nomenclatures-destination-et-nature', query: 'exports/json', key: { type_mission: r.type_mission, code_mission: r.code_mission, programme: r.programme, action: r.action, sous_action: r.sous_action, code_titre: r.code_titre, categorie: r.categorie }, field: 'cp_plf' }, { unitIn: 'EUR' });
  const byCat = sumBy(bg, r => String(r.categorie));
  const made = new Set();
  const edgeId = (from, to, op, suffix = '') => `${year}:${basis}:${from}>${to}:${op}${suffix}`;
  for (const [cat, agg] of byCat) {
    const c = TITRES.categories[cat];
    const op = `T${cat[0]}.${cat}`;
    const opLabel = `${TITRES.titres[cat[0]]} : ${c.label.toLowerCase()}`;
    const root = graph.edge({ id: edgeId(STATE, c.to, op), from: STATE, to: c.to, op, opLabel, year, basis, keur: agg.keur, derivation: 'sum', prov: [mappingProv, ...new Set(agg.rows.map(rowProv))].slice(0, 400), note: `Crédits de paiement du budget général, catégorie ${cat} (${c.label}), toutes missions.` });
    // Down the tree.
    const descend = (parent, list, level) => {
      const keyFn = idOf[level];
      const groups = sumBy(list, keyFn);
      for (const [id, g] of groups) {
        if (!graph.nodes.has(id)) continue;
        const e = graph.edge({ id: edgeId(id, c.to, op), from: id, to: c.to, op, opLabel, year, basis, keur: g.keur, parent: parent.id, split: 'from', derivation: g.rows.length === 1 ? 'direct' : 'sum', prov: [mappingProv, ...new Set(g.rows.map(rowProv))].slice(0, 400) });
        const next = { mission: 'programme', programme: 'action', action: 'sousAction' }[level];
        if (next) descend(e, g.rows.filter(r => next !== 'sousAction' || (r.sous_action !== null && r.sous_action !== undefined && r.sous_action !== '')), next);
      }
    };
    descend(root, agg.rows, 'mission');
    made.add(op);
  }
  // Prélèvements sur recettes: to the local authorities and to the EU budget.
  const psrCt = vm.rows['PSR-CT'], psrUe = vm.rows['PSR-UE'];
  const col = vm.columns.bill === year ? 'bill' : (vm.columns.lfi === year ? 'lfi' : 'exec');
  graph.edge({ id: edgeId(STATE, 'S1313', 'PSR-CT'), from: STATE, to: 'S1313', op: 'PSR-CT', opLabel: psrCt.label, year, basis, keur: toKeur(psrCt[col], psrCt.unit), derivation: 'direct', prov: [provVm(psrCt, col)], note: 'Dotation globale de fonctionnement, FCTVA et autres prélèvements au profit des collectivités territoriales, prélevés sur les recettes de l’État avant dépense.' });
  graph.edge({ id: edgeId(STATE, 'S2.EU', 'PSR-UE'), from: STATE, to: 'S2.EU', op: 'PSR-UE', opLabel: psrUe.label, year, basis, keur: toKeur(psrUe[col], psrUe.unit), derivation: 'direct', prov: [provVm(psrUe, col)], note: 'Contribution de la France au budget de l’Union européenne.' });

  // Receipts by tax, from the Voies et moyens summary.
  let totalIn = 0;
  for (const [code, r] of Object.entries(TITRES.receipts)) {
    const row = vm.rows[code];
    const keur = toKeur(row[col], row.unit);
    totalIn += keur;
    graph.edge({ id: edgeId(r.from, STATE, r.op), from: r.from, to: STATE, op: r.op, opLabel: r.label, year, basis, keur, derivation: r.derivation, prov: [provVm(row, col)], note: r.note });
  }
  // The balance: what the general budget spends beyond its net receipts.
  let totalOut = 0;
  for (const e of graph.edges.values()) if (e.year === year && e.basis === basis && e.from === STATE && !e.parent) totalOut += e.keur;
  const solde = totalOut - totalIn;
  graph.edge({ id: edgeId('FINANCEMENT', STATE, 'SOLDE'), from: 'FINANCEMENT', to: STATE, op: 'SOLDE', opLabel: 'Solde du budget général (calculé)', year, basis, keur: solde, derivation: 'residual', prov: [provVm(vm.rows.TOTAL, col), mappingProv], note: 'Dépenses nettes du budget général et prélèvements sur recettes, moins les recettes nettes : ce que l’État emprunte. Calculé à partir des chiffres affichés ; les budgets annexes et comptes spéciaux ne sont pas compris.', flags: ['computed'] });
  return { totalIn, totalOut, solde, missions: new Set(bg.map(r => r.code_mission)).size, rows: bg.length };
}

module.exports = { buildBudget, STATE };
