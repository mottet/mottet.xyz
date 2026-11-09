'use strict';

// The Flux pipeline: fetch the official files (cached under data/flux/raw),
// parse them, build the graph, validate it and emit the shards the site
// reads into flux/graph/. Run `node --no-warnings flux-pipeline/run.cjs`,
// with --offline to use the cache only, --years 2021-2024 to limit the
// years, --out <dir> to write elsewhere (the checks do).
const fs = require('node:fs');
const path = require('node:path');
const { fetchCached } = require('./lib/fetch.cjs');
const { Registry } = require('./lib/provenance.cjs');
const { Graph } = require('./lib/graph.cjs');
const Euro = require('./lib/eurostat.cjs');
const { SOURCES } = require('./sources.cjs');
const apuParser = require('./parsers/insee-apu.cjs');
const teeParser = require('./parsers/insee-tee.cjs');
const euroParser = require('./parsers/eurostat-gov.cjs');
const { buildMacro } = require('./build/macro.cjs');
const { buildBudget } = require('./build/budget.cjs');
const vmParser = require('./parsers/vm-tome1.cjs');
const { client: odsClient } = require('./lib/ods.cjs');
const { toText } = require('./lib/pdf.cjs');

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };

async function main() {
  const offline = flag('offline');
  const out = path.resolve(opt('out', path.join(__dirname, '..', 'flux', 'graph')));
  const [y0, y1] = opt('years', '2021-2025').split('-').map(Number);
  const years = []; for (let y = y0; y <= (y1 || y0); y++) years.push(y);
  const registry = new Registry();
  for (const [id, s] of Object.entries(SOURCES)) registry.source(id, { org: s.org, title: s.title, url: s.url, licence: s.licence, note: s.note });

  // Fetch and parse.
  const apu = {};
  for (const table of Object.keys(apuParser.SECTORS)) {
    const got = await fetchCached({ source: 'insee-apu-2025', url: SOURCES['insee-apu'].files(table), name: `t_${table}_fr`, offline });
    apu[table] = apuParser.parse(fs.readFileSync(got.file), Number(table));
    apu[table].retrieved = got.retrieved; apu[table].sha256 = got.sha256;
  }
  const tee = {};
  for (const y of years) {
    try {
      const got = await fetchCached({ source: 'insee-tee', url: SOURCES['insee-tee'].files(y), name: `TEE_${y}`, offline });
      tee[y] = teeParser.parse(fs.readFileSync(got.file), y);
    } catch (error) { console.error(`TEE ${y}: ${error.message}`); }
  }
  const cofogTable = await Euro.table('eurostat', 'gov_10a_exp', { geo: 'FR', unit: 'MIO_EUR', sector: ['S13', 'S1311', 'S1313', 'S1314'], na_item: 'TE', time: years.map(String) }, { offline });
  const cofog = euroParser.parse(JSON.parse(fs.readFileSync(cofogTable.file, 'utf8')));
  const drees = odsClient('https://data.drees.solidarites-sante.gouv.fr', 'drees');
  const cps = await drees.exportJson('305_les-comptes-de-la-protection-sociale', { select: 'annee,ps_niveau,ps_code,ps_lib,si_code,si_nom,sum(val) as val', where: `ps_niveau in ('0','1') and si_niveau='1' and annee in (${years.map(y => `'${y}'`).join(',')})`, group_by: 'annee,ps_niveau,ps_code,ps_lib,si_code,si_nom' }, { offline });
  const euroTable = await Euro.table('eurostat', 'gov_10a_main', { geo: 'FR', unit: 'MIO_EUR', sector: ['S13', 'S1311', 'S1313', 'S1314', 'S212'], time: years.map(String) }, { offline });
  const euro = euroParser.parse(JSON.parse(fs.readFileSync(euroTable.file, 'utf8')));
  const vintages = [
    { source: 'insee-apu', retrieved: apu[3201].retrieved, sha256: apu[3201].sha256 },
    { source: 'eurostat-gov', updated: euro.updated, retrieved: euroTable.retrieved, years: euro.years },
    { source: 'eurostat-cofog', updated: cofog.updated, retrieved: cofogTable.retrieved },
    { source: 'drees-cps', retrieved: cps.retrieved, sha256: cps.sha256 },
  ];
  const yearsBuilt = years.filter(y => tee[y] && apu[3201].items.TE[y]);
  // Control totals the data check compares the shards with.
  const controls = {};
  for (const y of yearsBuilt) {
    const g = (s, i) => { const r = euro.get(s, i, y); return r ? r.value : null; };
    controls[`${y}/sna`] = { TE: g('S13', 'TE'), TR: g('S13', 'TR'), B9: g('S13', 'B9'), insee: { TE: apu[3201].items.TE[y].value, TR: apu[3201].items.TR[y].value, B9: apu[3201].items.B9[y].value }, unit: { eurostat: 'MEUR', insee: 'MDEUR' } };
  }
  // The site opens on the last year whose accounts are not provisional (Insee publishes year N as provisional in May N+1).
  const provisional = y => y >= new Date().getFullYear() - 1;
  const defaultYear = yearsBuilt.filter(y => !provisional(y)).pop() || yearsBuilt[yearsBuilt.length - 1];
  console.error(`years ${yearsBuilt.join(', ')} (Eurostat has ${euro.years.join(', ')}), default ${defaultYear}`);

  // The State budget: PLF 2025 by destination and nature, receipts from the Voies et moyens.
  const eco = odsClient('https://data.economie.gouv.fr', 'data-economie');
  const nature = await eco.exportJson('plf25-depenses-2025-du-bg-et-des-ba-selon-nomenclatures-destination-et-nature', {}, { offline });
  const vmGot = await fetchCached({ source: 'vm', url: SOURCES['vm-2025'].url, name: 'vm-tome1-2025', ext: '.pdf', offline });
  const vm2025 = { ...vmParser.parse(toText(vmGot.file), { edition: 2025 }), file: 'Voies_et_moyens_Tome_1_2025.pdf' };
  const bases = { sna: { root: 'S13', label: 'Comptes nationaux', years: yearsBuilt }, 'budget-plf': { root: 'S13111', label: 'Projet de loi de finances', years: [2025], note: 'Budget général de l’État tel que présenté dans le PLF 2025 : crédits de paiement par mission, programme, action et sous-action, hors remboursements et dégrèvements (les recettes sont nettes) ; budgets annexes et comptes spéciaux non compris.' } };

  // Build.
  const graph = new Graph({ registry });
  buildMacro({ graph, registry, apu, tee, euro, years: yearsBuilt, cofog, cps: cps.rows });
  const budget = buildBudget({ graph, registry, year: 2025, rows: nature.rows, vm: vm2025, source: 'plf25-nature', vmSource: 'vm-2025' });
  controls['2025/budget-plf'] = { in: budget.totalIn, out: budget.totalOut, solde: budget.solde, missions: budget.missions, rows: budget.rows, unit: 'KEUR' };
  console.error(`budget 2025: ${budget.missions} missions, ${budget.rows} lines, out ${(budget.totalOut / 1e6).toFixed(1)} Md€, in ${(budget.totalIn / 1e6).toFixed(1)} Md€, solde ${(budget.solde / 1e6).toFixed(1)} Md€`);
  graph.finalize();
  const problems = graph.validate();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  for (const line of graph.log) console.error(`note: ${line}`);

  // Emit.
  const release = opt('release', new Date().toISOString().slice(0, 10).replace(/-/g, '') + 'a');
  const index = graph.emit(out, { release, built: new Date().toISOString().slice(0, 10), years: yearsBuilt, bases, vintages, controls, defaultYear, provisional: yearsBuilt.filter(provisional) });
  console.error(`emitted ${index.counts.nodes} nodes and ${index.counts.edges} edges to ${out} (release ${release})`);
}

main().catch(error => { console.error(error); process.exit(1); });
