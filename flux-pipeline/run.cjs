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
  const euroTable = await Euro.table('eurostat', 'gov_10a_main', { geo: 'FR', unit: 'MIO_EUR', sector: ['S13', 'S1311', 'S1313', 'S1314', 'S212'], time: years.map(String) }, { offline });
  const euro = euroParser.parse(JSON.parse(fs.readFileSync(euroTable.file, 'utf8')));
  const vintages = [
    { source: 'insee-apu', retrieved: apu[3201].retrieved, sha256: apu[3201].sha256 },
    { source: 'eurostat-gov', updated: euro.updated, retrieved: euroTable.retrieved, years: euro.years },
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

  // Build.
  const graph = new Graph({ registry });
  buildMacro({ graph, registry, apu, tee, euro, years: yearsBuilt });
  graph.finalize();
  const problems = graph.validate();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  for (const line of graph.log) console.error(`note: ${line}`);

  // Emit.
  const release = opt('release', new Date().toISOString().slice(0, 10).replace(/-/g, '') + 'a');
  const index = graph.emit(out, { release, built: new Date().toISOString().slice(0, 10), years: yearsBuilt, bases: ['sna'], vintages, controls, defaultYear, provisional: yearsBuilt.filter(provisional) });
  console.error(`emitted ${index.counts.nodes} nodes and ${index.counts.edges} edges to ${out} (release ${release})`);
}

main().catch(error => { console.error(error); process.exit(1); });
