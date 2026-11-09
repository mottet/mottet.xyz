'use strict';

// Flux checks. `--unit` runs the pipeline's readers, the graph rules and the
// server's host gating in Node alone; `--data` reads flux/graph and checks
// every figure (integers, provenance, splits that sum, the accounting
// identities against the control totals); `--browser` drives the site
// through Playwright (HOUSE_TEST_TOOLS). With no flag, unit and data run.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const http = require('node:http');
const express = require('express');

const ROOT = path.join(__dirname, '..');
const lib = name => require(path.join(ROOT, 'flux-pipeline', 'lib', name));

// A zip with stored entries, enough for an in-memory workbook.
function zipStore(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8'), nameBuf = Buffer.from(name);
    const crc = zlib.crc32 ? zlib.crc32(data) : 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}
const workbook = (sheets) => zipStore({
  'xl/workbook.xml': `<workbook><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels': `<Relationships>${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  'xl/sharedStrings.xml': `<sst><si><t>Total des dépenses</t></si><si><r><t>N.</t></r><r><t>D.</t></r></si></sst>`,
  ...Object.fromEntries(sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, `<worksheet><sheetData>${s.xml}</sheetData></worksheet>`])),
});

async function unit() {
  // xlsx: shared, rich, inline and plain strings, numbers, empty cells, a second sheet.
  const { readXlsx } = lib('xlsx.cjs');
  const wb = readXlsx(workbook([
    { name: 'A', xml: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2024</v></c><c r="C1" t="s"><v>1</v></c></row><row r="3"><c r="B3"><v>600.7015</v></c><c r="C3" t="inlineStr"><is><t>x &amp; y</t></is></c><c r="D3" t="str"><v>f</v></c></row>' },
    { name: 'B', xml: '<row r="1"><c r="A1"><v>1</v></c></row>' },
  ]));
  assert.deepEqual(wb.sheets.map(s => s.name), ['A', 'B']);
  const a = wb.sheet('A');
  assert.equal(a.get('A1'), 'Total des dépenses'); assert.equal(a.get('B1'), 2024); assert.equal(a.get('C1'), 'N.D.', 'rich text runs are joined');
  assert.equal(a.get('B3'), 600.7015); assert.equal(a.get('C3'), 'x & y'); assert.equal(a.get('D3'), 'f'); assert.equal(a.get('A2'), undefined);
  const rows = a.rows(); assert.equal(rows.length, 3); assert.equal(rows[1].length, 4); assert.equal(rows[2][1], 600.7015);
  assert.equal(wb.sheet('B').get('A1'), 1);
  // csv: delimiter detection, quotes with newlines, doubled quotes, BOM, streaming.
  const { parseCsv, readCsv } = lib('csv.cjs');
  assert.deepEqual(parseCsv('﻿a;b\n1;"x;y\n z"\n2;"q""r"\n'), [{ a: '1', b: 'x;y\n z' }, { a: '2', b: 'q"r' }]);
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n', { header: false }), [['a', 'b'], ['1', '2']]);
  const tmpCsv = path.join(require('node:os').tmpdir(), `flux-check-${process.pid}.csv`);
  fs.writeFileSync(tmpCsv, 'k;v\n' + Array.from({ length: 5000 }, (_, i) => `${i};"l${i}\nnext"`).join('\n') + '\n');
  const seen = []; const n = await readCsv(tmpCsv, r => { if (r.k === '4999') seen.push(r.v); });
  fs.unlinkSync(tmpCsv); assert.equal(n, 5000); assert.deepEqual(seen, ['l4999\nnext']);
  // eurostat: JSON-stat indices back to dimension codes.
  const { decode } = lib('eurostat.cjs');
  const js = { id: ['sector', 'na_item', 'time'], size: [2, 1, 2], value: { 0: 10, 1: 11, 3: 21 }, status: { 3: 'p' }, dimension: { sector: { category: { index: { S13: 0, S1311: 1 }, label: { S13: 'General government' } } }, na_item: { category: { index: { TE: 0 } } }, time: { category: { index: { 2023: 0, 2024: 1 } } } } };
  const d = decode(js);
  assert.deepEqual(d.records.map(r => [r.dims.sector, r.dims.time, r.value, r.status]), [['S13', '2023', 10, null], ['S13', '2024', 11, null], ['S1311', '2024', 21, 'p']]);
  assert.equal(d.records[0].labels.sector, 'General government');
  // pdf: a Voies et moyens row.
  const pdf = lib('pdf.cjs');
  const lines = ['  Impôts sur le revenu                              ', '     Taxe sur la valeur ajoutée nette                96,8           101,4           96,9            -4,5        109,1           +12,2', '  Total  1 234,5  n.s.  -'];
  const row = pdf.findRow(lines, 'Taxe sur la valeur ajoutée nette', { columns: 6 });
  assert.deepEqual(row.figures, [96.8, 101.4, 96.9, -4.5, 109.1, 12.2]); assert.equal(row.index, 1);
  assert.deepEqual(pdf.splitRow(lines[2]), { label: 'Total', figures: [1234.5, null, null] });
  assert.equal(pdf.findRow(lines, 'Impôt sur les sociétés'), null);
  // units: integer k€, half to even, French figures.
  const { toKeur, parseFr } = lib('units.cjs');
  assert.equal(toKeur(483.631, 'MDEUR'), 483631000); assert.equal(toKeur(3464537422, 'EUR'), 3464537); assert.equal(toKeur(2500, 'EUR'), 2); assert.equal(toKeur(3500, 'EUR'), 4); assert.equal(toKeur(-0.4, 'MDEUR'), -400000); assert.equal(toKeur(1.1, 'MEUR'), 1100);
  assert.throws(() => toKeur(NaN, 'MEUR')); assert.throws(() => toKeur('1', 'MEUR')); assert.throws(() => toKeur(1, 'FRF'));
  assert.equal(parseFr('1 234,5'), 1234.5); assert.equal(parseFr('N.D.'), null); assert.equal(parseFr('-4,5'), -4.5); assert.throws(() => parseFr('abc'));
  // provenance: one id per locator, sources need a licence.
  const { Registry } = lib('provenance.cjs');
  const reg = new Registry();
  assert.throws(() => reg.source('x', { org: 'A', title: 't', url: 'u', licence: 'WTF' }));
  reg.source('insee', { org: 'Insee', title: 't', url: 'https://insee.fr', licence: 'LO2' });
  const p1 = reg.prov('insee', { cell: 'B3' }), p2 = reg.prov('insee', { cell: 'B3' }), p3 = reg.prov('insee', { cell: 'B4' });
  assert.equal(p1, p2); assert.notEqual(p1, p3); assert.throws(() => reg.prov('nope', {}));
  // graph: splits sum with residuals, signs, consolidation, op splits, totals, determinism.
  const { Graph } = lib('graph.cjs');
  const mk = () => {
    const g = new Graph({ registry: reg });
    g.node({ id: 'H', kind: 'sector', label: 'Hub', role: 'hub' }); g.node({ id: 'H1', parent: 'H', kind: 'sector', label: 'Hub 1' }); g.node({ id: 'H2', parent: 'H', kind: 'sector', label: 'Hub 2' });
    g.node({ id: 'P', kind: 'sector', label: 'Payer' }); g.node({ id: 'F', kind: 'class', label: 'Financing' });
    return g;
  };
  let g = mk();
  const r = g.edge({ id: 'r', from: 'P', to: 'H', op: 'D5', year: 2024, basis: 'sna', keur: 100, derivation: 'direct', prov: [p1] });
  g.edge({ id: 'r1', parent: 'r', split: 'to', from: 'P', to: 'H1', op: 'D5', year: 2024, basis: 'sna', keur: 60, derivation: 'direct', prov: [p1] });
  g.edge({ id: 'r2', parent: 'r', split: 'to', from: 'P', to: 'H2', op: 'D5', year: 2024, basis: 'sna', keur: 30, derivation: 'direct', prov: [p1] });
  g.edge({ id: 'o1', parent: 'r', split: 'op', from: 'P', to: 'H', op: 'D51', year: 2024, basis: 'sna', keur: 100, derivation: 'direct', prov: [p1] });
  const b = g.edge({ id: 'b', from: 'F', to: 'H', op: 'B9', year: 2024, basis: 'sna', keur: 50, derivation: 'direct', prov: [p1] });
  const b1 = g.edge({ id: 'b1', parent: 'b', split: 'to', from: 'F', to: 'H1', op: 'B9', year: 2024, basis: 'sna', keur: 70, derivation: 'direct', prov: [p1] });
  const b2 = g.edge({ id: 'b2', parent: 'b', split: 'to', from: 'F', to: 'H2', op: 'B9', year: 2024, basis: 'sna', keur: -20, derivation: 'direct', prov: [p1] });
  assert.equal(b2.from, 'H2'); assert.equal(b2.to, 'F'); assert.equal(b2.sign, -1); assert.equal(b1.sign, 1); assert.ok(b2.flags.includes('sign-flipped'));
  const c = g.edge({ id: 'c', from: 'H', to: 'F', op: 'D41', year: 2024, basis: 'sna', keur: 100, derivation: 'direct', prov: [p1] });
  g.edge({ id: 'c1', parent: 'c', split: 'from', from: 'H1', to: 'F', op: 'D41', year: 2024, basis: 'sna', keur: 80, derivation: 'direct', prov: [p1] });
  g.edge({ id: 'c2', parent: 'c', split: 'from', from: 'H2', to: 'F', op: 'D41', year: 2024, basis: 'sna', keur: 25, derivation: 'direct', prov: [p1] });
  c.consolidated = 5;
  assert.throws(() => g.edge({ id: 'bad', from: 'P', to: 'H', op: 'X', year: 2024, basis: 'sna', keur: 1.5, derivation: 'direct', prov: [p1] }), /keur/);
  assert.throws(() => g.edge({ id: 'bad', from: 'P', to: 'H', op: 'X', year: 2024, basis: 'sna', keur: 1, derivation: 'guess', prov: [p1] }), /derivation/);
  assert.throws(() => g.edge({ id: 'bad', from: 'P', to: 'H', op: 'X', year: 2024, basis: 'sna', keur: 1, derivation: 'direct', prov: [] }), /provenance/);
  assert.throws(() => g.edge({ id: 'bad', from: 'P', to: 'H', op: 'X', year: 2024, basis: 'sna', keur: 1, derivation: 'direct', prov: ['insee:nothere'] }), /unknown/);
  g.finalize();
  const nd = g.edges.get('r~to~nd'); assert.ok(nd, 'a residual fills the gap'); assert.equal(nd.keur, 10); assert.equal(nd.to, 'H.ND'); assert.equal(nd.derivation, 'residual'); assert.ok(g.nodes.has('H.ND'));
  assert.equal(g.edges.has('r~op~nd'), false, 'an op split that sums exactly needs none');
  assert.equal(g.edges.has('b~to~nd'), false, 'signed children sum to the parent');
  assert.equal(g.edges.has('c~from~nd'), false, 'consolidated flows explain the excess');
  assert.deepEqual(g.validate(), []);
  const t = g.totals();
  assert.deepEqual(t.get('H')['2024/sna'], { in: 150, out: 100 }); assert.deepEqual(t.get('H1')['2024/sna'], { in: 130, out: 80 }); assert.deepEqual(t.get('H2')['2024/sna'], { in: 30, out: 45 }); assert.deepEqual(t.get('H.ND')['2024/sna'], { in: 10, out: 0 });
  const j1 = JSON.stringify(g.toJSON()); g = mk();
  g.edge({ id: 'r', from: 'P', to: 'H', op: 'D5', year: 2024, basis: 'sna', keur: 100, derivation: 'direct', prov: [p1] });
  assert.ok(JSON.stringify(g.toJSON()).length < j1.length && JSON.stringify(mk().toJSON()) === JSON.stringify(mk().toJSON()), 'serialisation is deterministic');
  // The Voies et moyens summary, as pdftotext lays it out (2026 edition, and the wrapped energy row of 2025).
  const vm = require(path.join(ROOT, 'flux-pipeline', 'parsers', 'vm-tome1.cjs'));
  const summary = ['     Recettes fiscales nettes                        325,7          349,6           353,8          +4,2         372,9           +19,1', '     Impôt net sur le revenu                         88,0           94,5            94,9           +0,4         104,0           +9,1', '     Impôt net sur les sociétés                      57,4           53,0            58,2           +5,2         59,0            +0,8', '     Accises sur les énergies nettes                 20,2           24,0            25,6           +1,6         22,9            -2,8', '     Taxe sur la valeur ajoutée nette                96,8           101,4           96,9            -4,5        109,1           +12,2', '     Autres recettes fiscales nettes                 63,3           76,6            78,1           +1,5         77,9           -0,2', '     Recettes non fiscales                           23,2           21,0            23,2           +2,2         28,7            +5,5', '     Recettes totales de l’État                      348,9          370,6           377,0          +6,4         401,6           +24,6'];
  const psr = ['Prélèvements sur les recettes de l\'État au profit des collectivités territoriales                              45 456 845   45 231 898   46 156 960    49 514 697', '3201 – Prélèvement sur les recettes de l\'État au profit du budget de l\'Union européenne    22 276 394   23 098 098   22 972 980    28 781 025'];
  const parsed26 = vm.parse(summary.join('\n') + '\f' + psr.join('\n'), { edition: 2026 });
  assert.deepEqual(parsed26.columns, { exec: 2024, lfi: 2025, revised: 2025, bill: 2026 });
  assert.equal(parsed26.rows.TVA.bill, 109.1); assert.equal(parsed26.rows.IR.exec, 88); assert.equal(parsed26.rows['PSR-UE'].bill, 28781025); assert.equal(parsed26.rows['PSR-CT'].unit, 'KEUR'); assert.equal(parsed26.rows.TOTAL.page, 1); assert.equal(parsed26.rows['PSR-UE'].page, 2);
  const summary25 = summary.map(l => l.replace('Accises sur les énergies nettes                 20,2           24,0            25,6           +1,6         22,9            -2,8', 'Taxe intérieure de consommation\n                                                   16,8              15,4             15,5            0,1         16,5                1,0\n     sur les produits énergétiques nette').replace('63,3           76,6            78,1           +1,5         77,9           -0,2', '63,3           76,6            78,1           +1,5         74,2*           -0,2')).map(l => (/Recettes totales/.test(l) ? '     Recettes totales de l’État   345,5   361,9   366,8   +6,4   391,5   +24,6' : l));
  const parsed25 = vm.parse(summary25.join('\n') + '\f' + psr.join('\n'), { edition: 2025 });
  assert.equal(parsed25.rows.TICPE.bill, 16.5, 'a label wrapped over three lines'); assert.equal(parsed25.rows.AUTRES.bill, 74.2, 'a footnote star is ignored');
  assert.throws(() => vm.parse(summary.join('\n').replace('401,6', '300,0') + '\f' + psr.join('\n'), { edition: 2026 }), /parts/, 'a summary that does not add up is refused');
  // The parsers on the cached official files, when the cache is there.
  const { readManifest, RAW } = lib('fetch.cjs');
  const apuDir = path.join(RAW, 'insee-apu-2025');
  const apuEntry = readManifest(apuDir).entries.find(e => e.key.startsWith('t_3203_fr'));
  if (apuEntry && fs.existsSync(path.join(apuDir, apuEntry.file))) {
    const parsed = require(path.join(ROOT, 'flux-pipeline', 'parsers', 'insee-apu.cjs')).parse(fs.readFileSync(path.join(apuDir, apuEntry.file)), 3203);
    assert.equal(parsed.sector, 'S13111'); assert.ok(parsed.items.TE[2024].value > 500 && parsed.items.TE[2024].value < 700); assert.match(parsed.items.TE[2024].cell, /^[A-Z]+\d+$/);
    assert.ok(Math.abs(parsed.items.TR[2024].value - parsed.items.TE[2024].value - parsed.items.B9[2024].value) < 0.001, 'TR − TE = B9');
  } else console.log('  (no cached Insee table: parser check skipped)');
  // flux-server: host gating, cache headers, bench gating, 404.
  const Flux = require(path.join(ROOT, 'flux-server.js'));
  const site = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'flux-site-'));
  fs.mkdirSync(path.join(site, 'graph', 'r', 'x'), { recursive: true }); fs.mkdirSync(path.join(site, 'bench'));
  fs.writeFileSync(path.join(site, 'index.html'), '<title>Flux</title>'); fs.writeFileSync(path.join(site, 'graph', 'index.json'), '{}'); fs.writeFileSync(path.join(site, 'graph', 'r', 'x', 'nodes.json'), '[]'); fs.writeFileSync(path.join(site, 'bench', 'index.html'), 'bench');
  const app = express(); app.use(Flux({ site, bench: false }).middleware); app.use((req, res) => res.status(200).send('house'));
  const srv = await new Promise(r => { const s = http.createServer(app).listen(0, '127.0.0.1', () => r(s)); });
  const get = (p, host) => new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port: srv.address().port, path: p, headers: { host } }, res => { let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); }).on('error', reject));
  assert.equal((await get('/', 'mottet.xyz')).body, 'house', 'another host falls through');
  let res = await get('/', 'flux.localhost'); assert.equal(res.status, 200); assert.match(res.body, /Flux/); assert.equal(res.headers['cache-control'], 'no-cache');
  res = await get('/graph/index.json', 'flux.localhost'); assert.equal(res.headers['cache-control'], 'no-cache');
  res = await get('/graph/r/x/nodes.json', 'flux.localhost'); assert.match(res.headers['cache-control'], /immutable/);
  res = await get('/bench/', 'flux.localhost'); assert.equal(res.status, 404);
  res = await get('/nothing', 'flux.localhost'); assert.equal(res.status, 404); assert.equal(res.body, 'Pas ici.');
  srv.close(); fs.rmSync(site, { recursive: true, force: true });
  await front();
  console.log('PASS unit: xlsx, csv, JSON-stat, pdf rows, units, provenance, the graph rules, the parsers, the server and the site modules');
}

// The site's own modules (ES modules): numbers, the address bar, the model's cuts, the layout.
async function front() {
  const fr = await import(path.join(ROOT, 'flux', 'js', 'fr.js'));
  assert.equal(fr.formatEuros(1234567890), '1\u202f235\u00a0Md€'); assert.equal(fr.formatEuros(845000), '845\u00a0M€'); assert.equal(fr.formatEuros(12400), '12,4\u00a0M€'); assert.equal(fr.formatEuros(320), '320\u00a0k€'); assert.equal(fr.formatEuros(0.85), '850\u00a0€'); assert.equal(fr.formatEuros(-3200000), '\u22123,2\u00a0Md€'); assert.equal(fr.formatEuros(0), '0\u00a0€');
  assert.equal(fr.formatShare(0.1234), '12,3\u00a0%'); assert.equal(fr.formatDate('2026-11-09'), '9 novembre 2026'); assert.equal(fr.formatDate('2026-01-01'), '1er janvier 2026');
  const url = await import(path.join(ROOT, 'flux', 'js', 'url-state.js'));
  const st = { year: 2023, basis: 'sna', hubLevel: 2, expanded: ['S1313', 'S14'], ops: true, selected: 'apu:S13111', theme: 'sombre' };
  const q = url.encode(st, { year: 2024, basis: 'sna' });
  assert.equal(q, '?a=2023&h=2&x=S1313%2CS14&o=1&n=apu%3AS13111&t=sombre');
  const back = url.decode(q, { years: [2021, 2022, 2023, 2024], bases: ['sna'], defaults: { year: 2024, basis: 'sna', hubLevel: 0, expanded: [], ops: false, selected: null, theme: 'auto' } });
  assert.deepEqual(back, { ...st, expanded: ['S1313', 'S14'], focus: null, zoom: 1 });
  assert.ok(url.encode({ ...st, zoom: 2.25 }, { year: 2024, basis: 'sna' }).includes('z=2.3')); assert.equal(url.decode('?z=3.4', { years: [2024] }).zoom, 3.4); assert.equal(url.decode('?z=40', { years: [2024] }).zoom, 1, 'a zoom out of range is ignored');
  assert.equal(url.decode('?f=OFGL.COM.D29', { years: [2024], bases: ['sna'] }).focus, 'OFGL.COM.D29');
  assert.ok(url.encode({ ...st, focus: 'S1313' }, { year: 2024, basis: 'sna' }).includes('f=S1313'));
  assert.equal(url.encode({ year: 2024, basis: 'sna', hubLevel: 0, expanded: [], ops: false, selected: null, theme: 'auto' }, { year: 2024, basis: 'sna' }), '', 'defaults are left out');
  assert.equal(url.decode('?a=1999&h=9&x=bad id&t=x', { years: [2024], bases: ['sna'], defaults: { year: 2024, basis: 'sna', hubLevel: 0, expanded: [], ops: false, selected: null, theme: 'auto' } }).year, 2024, 'a bad year falls back');
  // Search: accents and hyphens folded, exact names first, the biggest first within a rank.
  const { SearchIndex, fold, basisOf } = await import(path.join(ROOT, 'flux', 'js', 'search.js'));
  assert.equal(fold('Saint-Étienne-du-Rouvray'), 'saint etienne du rouvray'); assert.equal(fold('L’Haÿ-les-Roses'), 'l hay les roses');
  const six = new SearchIndex({ rows: [['OFGL.COM.D75.E1', 'Commune : Paris', 'Paris, 75056', 2024, 9000, 'OFGL.COM.D75'], ['S13111.M.EA', 'Mission Écologie, développement et mobilité durables', 'État', 2025, 800, ''], ['OFGL.COM.D62.E2', 'Commune : Le Touquet-Paris-Plage', 'Pas-de-Calais, 62826', 2024, 70, 'OFGL.COM.D62'], ['OFGL.COM.D95.E3', 'Commune : Cormeilles-en-Parisis', "Val-d'Oise, 95176", 2024, 30, 'OFGL.COM.D95'], ['OFGL.COM.D03.E4', 'Commune : Paray-sous-Briailles', 'Allier, 03204', 2024, 1, 'OFGL.COM.D03']] });
  assert.deepEqual(six.find('paris').map(r => r.id), ['OFGL.COM.D75.E1', 'OFGL.COM.D62.E2', 'OFGL.COM.D95.E3'], 'the exact name first, then the others by amount');
  assert.equal(six.find('ecologie mobilite')[0].id, 'S13111.M.EA'); assert.equal(six.find('62826')[0].id, 'OFGL.COM.D62.E2', 'an INSEE code finds its commune'); assert.deepEqual(six.find('p'), []); assert.deepEqual(six.find('zzz'), []);
  assert.equal(basisOf('OFGL.COM.D29'), 'local-ofgl'); assert.equal(basisOf('S13111.M.EA.P203'), 'budget-plf'); assert.equal(basisOf('S13111'), 'sna');
  // The model on the committed release: every cut balances with the stored totals.
  const dir = path.join(ROOT, 'flux', 'graph');
  if (fs.existsSync(path.join(dir, 'index.json'))) {
    const { Model, HUB } = await import(path.join(ROOT, 'flux', 'js', 'model.js'));
    const { buildView } = await import(path.join(ROOT, 'flux', 'js', 'view.js'));
    const { layout } = await import(path.join(ROOT, 'flux', 'js', 'layout.js'));
    const { interpolate } = await import(path.join(ROOT, 'flux', 'js', 'interpolate.js'));
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    const model = new Model(JSON.parse(fs.readFileSync(path.join(dir, index.shards.nodes), 'utf8')));
    const year = index.defaultYear, key = `${year}/sna`;
    model.addEdges(key, JSON.parse(fs.readFileSync(path.join(dir, index.shards.edges[key]), 'utf8')));
    const base = { year, basis: 'sna', hubLevel: 0, expanded: [], ops: false };
    const sum = (v, side) => v.ribbons.filter(r => r.side === side).reduce((s, r) => s + r.keur, 0);
    const v0 = buildView(model, base);
    assert.equal(v0.nodes.filter(n => n.column === 1).length, 1, 'the hub is one node at level 0');
    const hub = model.node(HUB).totals[key];
    assert.equal(sum(v0, 'payeurs'), hub.in, 'payer ribbons equal the hub receipts');
    assert.equal(sum(v0, 'benef'), hub.out, 'beneficiary ribbons equal the hub expenses');
    assert.equal(v0.intra.length, 0, 'nothing is left undrawn');
    for (const hubLevel of [1, 2, 3]) {
      const v = buildView(model, { ...base, hubLevel });
      const hubNodes = v.nodes.filter(n => n.column === 1 && !n.unsplit);
      assert.ok(hubNodes.length > 1 + hubLevel, `level ${hubLevel} shows ${hubNodes.length} hub nodes`);
      for (const n of hubNodes) {
        const t = model.node(n.base).totals[key]; if (!t) continue;
        const inR = v.ribbons.filter(r => r.to === n.id).reduce((s, r) => s + r.keur, 0);
        const outR = v.ribbons.filter(r => r.from === n.id).reduce((s, r) => s + r.keur, 0);
        const ownIn = 0, ownOut = 0;
        const unsplitIn = v.ribbons.filter(r => r.to === `apu:${n.base}.*`).reduce((s, r) => s + r.keur, 0);
        const unsplitOut = v.ribbons.filter(r => r.from === `apu:${n.base}.*`).reduce((s, r) => s + r.keur, 0);
        assert.ok(inR + ownIn + unsplitIn <= t.in + 1 && inR + ownIn + unsplitIn >= t.in - 1 || n.synthetic, `${n.base} level ${hubLevel}: in ${inR + ownIn + unsplitIn} vs total ${t.in}`);
        assert.ok(outR + ownOut + unsplitOut <= t.out + 1 && outR + ownOut + unsplitOut >= t.out - 1 || n.synthetic, `${n.base} level ${hubLevel}: out ${outR + ownOut + unsplitOut} vs total ${t.out}`);
      }
    }
    const vx = buildView(model, { ...base, expanded: ['S13', 'S1313'] });
    assert.ok(vx.nodes.some(n => n.id === 'apu:S13131') && vx.nodes.some(n => n.id === 'apu:S1311'), 'expanding one branch leaves the others whole');
    const vo = buildView(model, { ...base, ops: true });
    assert.ok(vo.ribbons.some(r => r.ops.some(o => o.op === 'D611')), 'operations split the contributions');
    // Layout: deterministic, inside the box, ribbon widths add up to the node, vertical is a transpose.
    const L1 = layout({ nodes: v0.nodes.map(n => ({ ...n })), ribbons: v0.ribbons.map(r => ({ ...r })), columns: 3, width: 1200, height: 600 });
    const L2 = layout({ nodes: v0.nodes.map(n => ({ ...n })), ribbons: v0.ribbons.map(r => ({ ...r })), columns: 3, width: 1200, height: 600 });
    assert.equal(JSON.stringify(L1.nodes.map(n => [n.id, n.x, n.y, n.height])), JSON.stringify(L2.nodes.map(n => [n.id, n.x, n.y, n.height])), 'deterministic');
    for (const n of L1.nodes) { assert.ok(n.y >= 0 && n.y + n.height <= 600.5 && n.x >= 0 && n.x + n.width <= 1200, `${n.id} inside`); }
    const hubL = L1.nodes.find(n => n.id === 'apu:S13');
    const widths = L1.ribbons.filter(r => r.to === hubL.id).reduce((s, r) => s + r.w, 0);
    assert.ok(Math.abs(widths - hubL.height) < 1.5, `ribbon widths ${widths} vs node height ${hubL.height}`);
    for (const r of L1.ribbons) { const a = L1.nodes.find(n => n.id === r.from), b = L1.nodes.find(n => n.id === r.to); assert.ok(r.y0 >= a.y - 0.01 && r.y0 + r.w <= a.y + a.height + 0.6, `ribbon ${r.key} leaves its source`); assert.ok(r.y1 >= b.y - 0.01 && r.y1 + r.w <= b.y + b.height + 0.6, `ribbon ${r.key} reaches its target`); }
    const LV = layout({ nodes: v0.nodes.map(n => ({ ...n })), ribbons: v0.ribbons.map(r => ({ ...r })), columns: 3, width: 600, height: 1200, orientation: 'vertical' });
    const hv = LV.nodes.find(n => n.id === 'apu:S13');
    assert.ok(hv.width > hv.height && Math.abs(hv.width - hubL.height) < 1.5, 'vertical swaps the axes');
    const Lx = layout({ nodes: vx.nodes.map(n => ({ ...n })), ribbons: vx.ribbons.map(r => ({ ...r })), columns: 3, width: 1200, height: 600 });
    const mid = interpolate(L1, Lx, 0.5, id => { const [side, node] = [id.split(':')[0], id.split(':').slice(1).join(':')]; return model.ancestors(node.replace(/\.\*$/, '')).map(a => `${side}:${a}`); });
    assert.equal(interpolate(L1, Lx, 1).nodes.length, Lx.nodes.length); assert.ok(mid.nodes.some(n => n.appearing), 'new nodes appear out of their parent');
    const appearing = mid.nodes.find(n => n.id === 'apu:S1311');
    assert.ok(appearing && appearing.height > 0 && appearing.height < Lx.nodes.find(n => n.id === 'apu:S1311').height, 'half-way, a new node is half-grown');
  }
}

// Every figure in flux/graph: integers, provenance, splits, identities.
async function data(dir = path.join(ROOT, 'flux', 'graph')) {
  const { expandFocus } = await import(path.join(ROOT, 'flux', 'js', 'compact.js'));
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const nodes = JSON.parse(fs.readFileSync(path.join(dir, index.shards.nodes), 'utf8'));
  const prov = JSON.parse(fs.readFileSync(path.join(dir, index.shards.provenance), 'utf8'));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const problems = [];
  for (const n of nodes) if (n.parent && !byId.has(n.parent)) problems.push(`node ${n.id}: parent missing`);
  for (const [id, r] of Object.entries(prov.records)) { if (!prov.sources[r.source]) problems.push(`prov ${id}: source missing`); if (!r.locator) problems.push(`prov ${id}: no locator`); }
  for (const s of Object.values(prov.sources)) for (const k of ['org', 'title', 'url', 'licence']) if (!s[k]) problems.push(`source ${s.id}: ${k} missing`);
  let edgesTotal = 0;
  let focusTotal = 0;
  for (const [key, file] of Object.entries(index.shards.edges)) {
    const edges = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const byEdge = new Map(edges.map(e => [e.id, e]));
    edgesTotal += edges.length;
    // The focus shards of this key: their nodes hang from known nodes, their edges from known edges.
    for (const [focusId, ffile] of Object.entries((index.shards.focus || {})[key] || {})) {
      const shard = JSON.parse(fs.readFileSync(path.join(dir, ffile), 'utf8'));
      if (!byId.has(focusId)) problems.push(`focus ${focusId}: group node missing`);
      for (const n of shard.nodes || []) { if (n.parent !== focusId && !byId.has(n.parent)) problems.push(`focus ${focusId}: node ${n.id} parent ${n.parent} unknown`); byId.set(n.id, n); }
      for (const [id, r] of Object.entries(shard.prov || {})) prov.records[id] = r;
      const [y, b] = key.split('/');
      for (const e of expandFocus(shard, { year: Number(y), basis: b })) { byEdge.set(e.id, e); edges.push(e); focusTotal++; }
    }
    const kids = new Map();
    for (const e of edges) {
      if (!Number.isInteger(e.keur) || e.keur < 0) problems.push(`${e.id}: keur ${e.keur}`);
      if (!byId.has(e.from) || !byId.has(e.to)) problems.push(`${e.id}: unknown end`);
      if (`${e.year}/${e.basis}` !== key) problems.push(`${e.id}: in the wrong shard`);
      if (e.derivation !== 'residual' && !(e.prov || []).length) problems.push(`${e.id}: no provenance`);
      for (const p of e.prov || []) if (!prov.records[p]) problems.push(`${e.id}: provenance ${p} missing`);
      if (e.parent) { if (!byEdge.has(e.parent)) problems.push(`${e.id}: parent missing`); const k = `${e.parent}|${e.split}`; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(e); }
    }
    for (const [k, list] of kids) {
      const cut = k.lastIndexOf('|'); const parent = byEdge.get(k.slice(0, cut));
      if (!parent) continue;
      const sum = list.reduce((s, e) => s + (e.sign || 1) * e.keur, 0);
      const target = parent.keur + (parent.consolidated || 0);
      if (Math.abs(sum - target) > list.length && !parent.flags.includes('over-coverage')) problems.push(`${k}: children ${sum} ≠ parent ${target}`);
    }
    // Identity: what comes in (receipts, non-recoverable, borrowing) equals what goes out (expenses, non-recoverable).
    const basis = key.split('/')[1];
    const hub = (index.bases && !Array.isArray(index.bases) && index.bases[basis] && index.bases[basis].root) || 'S13';
    const roots = edges.filter(e => !e.parent && !e.alt && !e.flags.includes('intra'));
    const hubIn = roots.filter(e => e.to === hub).reduce((s, e) => s + e.keur, 0);
    const hubOut = roots.filter(e => e.from === hub).reduce((s, e) => s + e.keur, 0);
    const slack = roots.length;
    if (Math.abs(hubIn - hubOut) > slack) problems.push(`${key}: ${hub} in ${hubIn} ≠ out ${hubOut}`);
    const ctl = index.controls && index.controls[key];
    if (ctl && ctl.in !== undefined) { const expectIn = ctl.in + Math.max(0, ctl.solde), expectOut = ctl.out + Math.max(0, -ctl.solde); if (Math.abs(expectIn - hubIn) > slack || Math.abs(expectOut - hubOut) > slack) problems.push(`${key}: ${hub} roots ${hubIn}/${hubOut} vs controls ${expectIn}/${expectOut}`); }
    if (ctl && ctl.TE !== undefined && ctl.TE !== null) {
      const d995 = roots.filter(e => e.op === 'D995').reduce((s, e) => s + e.keur, 0);
      const te = (hubOut - d995) / 1000, tr = (hubIn - d995 - roots.filter(e => e.op === 'B9').reduce((s, e) => s + e.keur, 0)) / 1000;
      if (Math.abs(te - ctl.TE) / ctl.TE > 0.001) problems.push(`${key}: expenses ${te} vs Eurostat TE ${ctl.TE}`);
      if (Math.abs(tr - ctl.TR) / ctl.TR > 0.001) problems.push(`${key}: receipts ${tr} vs Eurostat TR ${ctl.TR}`);
    }
    const s13 = byId.get(hub).totals[key];
    if (!s13 || Math.abs(s13.in - hubIn) > slack || Math.abs(s13.out - hubOut) > slack) problems.push(`${key}: ${hub} totals ${JSON.stringify(s13)} vs roots ${hubIn}/${hubOut}`);
  }
  // The search index: every row names a node of the main shard or of the focus shard it gives, with that node's amount.
  const readJson = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const search = readJson(index.shards.search);
  const focusFiles = Object.assign({}, ...Object.values(index.shards.focus || {}));
  const focusNodes = new Map();
  for (const [id, label, , year, keur, focus] of search.rows) {
    let n = byId.get(id);
    if (!n && focus) { if (!focusNodes.has(focus)) focusNodes.set(focus, new Map(readJson(focusFiles[focus]).nodes.map(x => [x.id, x]))); n = focusNodes.get(focus).get(id); }
    if (!n) { problems.push(`search: ${id} is not a node`); continue; }
    const basis = id.startsWith('OFGL') ? 'local-ofgl' : id.includes('.M.') ? 'budget-plf' : 'sna';
    const t = n.totals[`${year}/${basis}`];
    if (!t || Math.max(t.in, t.out) !== keur || n.label !== label) problems.push(`search: ${id} ${label} ${keur} does not match its node`);
  }
  if (search.rows.length < 30000) problems.push(`search: only ${search.rows.length} rows`);
  if (problems.length) { console.error(problems.slice(0, 40).join('\n')); throw new Error(`${problems.length} data problems`); }
  console.log(`PASS data: ${nodes.length} nodes, ${edgesTotal} edges over ${Object.keys(index.shards.edges).length} shards and ${focusTotal} edges in ${Object.values(index.shards.focus || {}).reduce((s, m) => s + Object.keys(m).length, 0)} focus shards, every figure sourced and every split summing (release ${index.release})`);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find(a => a.startsWith('--')) || null;
  if (!only || only === '--unit') await unit();
  if (!only || only === '--data') await data(args.includes('--dir') ? args[args.indexOf('--dir') + 1] : undefined);
  if (only === '--browser') await browser();
}

// The site in Chromium: the landing, a drill-down with its address, the
// details and their sources, the keyboard, the phone layout, the theme.
async function browser() {
  const TOOLS = process.env.HOUSE_TEST_TOOLS || process.env.UR_BUILD_TOOLS;
  if (!TOOLS) throw new Error('set HOUSE_TEST_TOOLS to a node_modules holding playwright');
  const { chromium } = require(path.join(TOOLS, 'playwright'));
  const { spawn } = require('node:child_process');
  const PORT = 8098;
  const server = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'inherit'] });
  process.on('exit', () => server.kill());
  await new Promise(r => setTimeout(r, 1200));
  const browserApp = await chromium.launch();
  const errors = [];
  const open = async (ctx, url) => { const page = await ctx.newPage(); page.on('pageerror', e => errors.push(`pageerror: ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); }); await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => performance.getEntriesByName('flux-ready').length > 0, null, { timeout: 30000 }); return page; };
  try {
    const base = `http://flux.localhost:${PORT}/`;
    const desktop = await browserApp.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    let page = await open(desktop, base);
    // The house is not here, and this is not on the house.
    const other = await desktop.newPage(); await other.goto(`http://127.0.0.1:${PORT}/`); assert.ok(!(await other.content()).includes('Qui paie quoi'), 'the house host does not show Flux'); await other.close();
    assert.match(await page.textContent('#headline'), /En 20\d\d, [\d\u202f]+\u00a0milliards/);
    assert.equal(await page.locator('.chart .node[data-id="apu:S13"]').count(), 1, 'one hub node on the landing');
    assert.ok((await page.locator('.chart .node').count()) >= 15, 'payers and beneficiaries around it');
    assert.match(await page.textContent('#footer-sources'), /Insee/);
    // Drill into the administrations: the address follows, Back undoes.
    await page.locator('.chart .node[data-id="apu:S13"] .bar').click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.chart .node[data-id="apu:S1314"]').count(), 1, 'social security appears');
    assert.ok(page.url().includes('x=S13'), `the address carries the expansion: ${page.url()}`);
    assert.equal(await page.locator('#chips .chip').count(), 1, 'a chip names what is expanded');
    await page.goBack(); await page.waitForTimeout(600);
    assert.equal(await page.locator('.chart .node[data-id="apu:S1314"]').count(), 0, 'Back collapses it');
    // Level select and operations.
    await page.selectOption('#hub-level', '2'); await page.waitForTimeout(600);
    assert.equal(await page.locator('.chart .node[data-id="apu:S13111"]').count(), 1, 'the State at level 2');
    await page.check('#ops'); await page.waitForTimeout(600);
    assert.ok(page.url().includes('o=1'));
    await page.uncheck('#ops'); await page.selectOption('#hub-level', '0'); await page.waitForTimeout(600);
    // A leaf opens its details, with official sources behind the figures.
    await page.locator('.chart .node[data-id="payeurs:FINANCEMENT"] .bar').click(); await page.waitForTimeout(300);
    assert.equal(await page.locator('#details').isVisible(), true);
    assert.match(await page.textContent('#details h2'), /Créanciers/);
    const href = await page.locator('#details .sources a').first().getAttribute('href');
    assert.match(href, /^https:\/\//, 'a source links to the official page');
    assert.ok(!(await page.textContent('#details')).includes('null'), 'no stray null in the panel');
    // Year change keeps the view, the sources panel lists the datasets, the table lists the flows.
    await page.selectOption('#year', String((await page.$$eval('#year option', o => o.map(x => x.value)))[0])); await page.waitForTimeout(700);
    assert.match(await page.textContent('#headline'), /En 202[0-9]/);
    await page.click('#btn-sources'); await page.waitForTimeout(200);
    assert.ok((await page.locator('#sources .sources li').count()) >= 2, 'the sources panel lists the datasets');
    await page.click('#btn-sources');
    await page.click('#btn-table'); await page.waitForTimeout(200);
    assert.ok((await page.locator('#table tbody tr').count()) >= 10, 'the table lists the visible flows');
    await page.click('#btn-table');
    // Keyboard: Tab reaches a node, Enter expands, Escape collapses.
    await page.locator('.chart .node[data-id="apu:S13"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    assert.equal(await page.locator('.chart .node[data-id="apu:S1311"]').count(), 1, 'Enter expands');
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    assert.equal(await page.locator('.chart .node[data-id="apu:S1311"]').count(), 0, 'Escape collapses');
    // The State budget basis: its own root, missions, and back to the national accounts on a year without it.
    if ((await page.$$eval('#basis option', o => o.map(x => x.value))).includes('budget-plf')) {
      await page.selectOption('#basis', 'budget-plf'); await page.waitForTimeout(800);
      assert.equal(await page.locator('.chart .node[data-id="apu:S13111"]').count(), 1, 'the State is the hub of the budget basis');
      assert.match(await page.textContent('#headline'), /Budget de l’État 2025/);
      await page.selectOption('#hub-level', '1'); await page.waitForTimeout(700);
      assert.ok((await page.locator('.chart .node[data-id^="apu:S13111.M."]').count()) >= 30, 'the missions appear');
      assert.equal(await page.locator('.chart .node[data-id="benef:CREANCIERS"]').count(), 1, 'interest goes to the creditors');
      await page.selectOption('#year', '2024'); await page.waitForTimeout(800);
      assert.equal(await page.inputValue('#basis'), 'sna', 'a year without the budget falls back to the national accounts');
      assert.equal(await page.locator('.chart .node[data-id="apu:S13"]').count(), 1);
    }
    // The local authorities basis: its own root and types, a département as an entity.
    if ((await page.$$eval('#basis option', o => o.map(x => x.value))).includes('local-ofgl')) {
      await page.selectOption('#basis', 'local-ofgl'); await page.waitForTimeout(800);
      assert.equal(await page.locator('.chart .node[data-id="apu:OFGL"]').count(), 1, 'the local root is the hub');
      assert.match(await page.textContent('#headline'), /Collectivités locales 2024/);
      await page.selectOption('#hub-level', '1'); await page.waitForTimeout(700);
      assert.equal(await page.locator('.chart .node[data-id="apu:OFGL.COM"]').count(), 1, 'the communes appear');
      assert.equal(await page.locator('.chart .node[data-id="payeurs:S13111"]').count(), 1, 'the State pays the dotations');
      await page.locator('.chart .node[data-id="apu:OFGL.DEP"] .bar').click(); await page.waitForTimeout(800);
      assert.ok((await page.locator('.chart .node[data-id^="apu:OFGL.DEP.E"]').count()) >= 30, 'the départements open, the smallest folded into Autres');
      assert.equal(await page.locator('.chart .node[data-id="apu:OFGL.DEP.autres"]').count(), 1, 'a bucket holds the rest');
      await page.locator('.chart .node[data-id="apu:OFGL.DEP"] .bar').click().catch(() => {});
      // The communes of one département come from a focus shard fetched when the group opens.
      await page.goto(`${base}?b=local-ofgl&a=2024&x=OFGL%2COFGL.COM`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
      const dep = await page.locator('.chart .node[data-id^="apu:OFGL.COM.D"] .bar').first();
      const depId = await dep.evaluate(el => el.parentElement.dataset.id);
      await dep.click(); await page.waitForTimeout(1500);
      assert.ok((await page.locator(`.chart .node[data-id^="${depId}.E"]`).count()) >= 20, `the communes of ${depId} appear after their shard loads`);
      assert.ok(page.url().includes(encodeURIComponent(depId.replace('apu:', ''))) || page.url().includes(depId.replace('apu:', '')), 'the address carries the opened département');
      const label = await page.locator(`.chart .node[data-id^="${depId}.E"]`).first().getAttribute('aria-label');
      assert.match(label, /Md€|M€|k€/);
      // Focus: one node becomes the hub with its own scale; the chips lead back.
      await page.goto(`${base}?b=local-ofgl&a=2024&f=OFGL.COM.D29`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
      assert.match(await page.textContent('#headline'), /Finistère\. En 2024, [\d,]+\u00a0(Md|M)€ reçus/);
      assert.equal(await page.locator('.chart .node[data-id="apu:OFGL.COM.D29"]').count(), 1, 'the focused group is the hub');
      assert.equal(await page.locator('.chart .node[data-id="apu:OFGL.COM"]').count(), 0, 'nothing above it is drawn');
      assert.ok((await page.locator('#chips .chip.focus').count()) >= 3, 'the chips show the path');
      await page.locator('.chart .node[data-id="apu:OFGL.COM.D29"] .bar').click(); await page.waitForTimeout(1500);
      assert.ok((await page.locator('.chart .node[data-id^="apu:OFGL.COM.D29.E"]').count()) >= 30, 'the focused group opens into its communes');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(700);
      assert.equal(await page.locator('.chart .node[data-id="apu:OFGL"]').count(), 1, 'Escape twice returns to the overview');
      // Search: a commune by name, from another basis, ends isolated with its own figures.
      await page.selectOption('#basis', 'sna'); await page.waitForTimeout(600);
      await page.fill('#search', 'douarnenez'); await page.waitForSelector('#search-results li[id="hit-0"]');
      assert.match(await page.textContent('#hit-0'), /Commune : Douarnenez.*Finistère/);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
      assert.match(await page.textContent('#headline'), /Commune : Douarnenez\. En 2024, [\d,]+\u00a0M€ reçus/);
      assert.match(page.url(), /b=local-ofgl.*f=OFGL\.COM\.D29\.E/);
      await page.fill('#search', 'programme 203'); await page.waitForSelector('#search-results li[id="hit-0"]');
      assert.match(await page.textContent('#hit-0'), /203.*Infrastructures/);
      await page.locator('#hit-0').dispatchEvent('pointerdown'); await page.waitForTimeout(1200);
      assert.match(page.url(), /b=budget-plf.*f=S13111\.M\.[A-Z]+\.P203/);
      await page.fill('#search', 'qqqq'); await page.waitForSelector('#search-results .none'); await page.keyboard.press('Escape');
      await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
      await page.selectOption('#basis', 'sna'); await page.waitForTimeout(800);
    }
    // Theme.
    await page.selectOption('#theme', 'sombre'); await page.waitForTimeout(200);
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    assert.ok(page.url().includes('t=sombre'));
    // A shared link opens the same view.
    const link = `${base}?x=S13%2CS1313&n=apu%3AS13131`;
    page = await open(desktop, link);
    assert.equal(await page.locator('.chart .node[data-id="apu:S13131"]').count(), 1, 'the link restores the expansion');
    assert.match(await page.textContent('#details h2'), /Collectivités/);
    await desktop.close();
    // The phone: left to right without gutters, labels beside the bars, zoom by buttons, keys and pinch, a sheet for the details.
    const phone = await browserApp.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    page = await open(phone, base);
    const hubBox = await page.locator('.chart .node[data-id="apu:S13"] .bar').boundingBox();
    assert.ok(hubBox.height > hubBox.width, 'on a phone the diagram still reads left to right');
    const shown = await page.locator('.chart .node .label').evaluateAll(els => els.filter(e => e.style.display !== 'none' && e.textContent && !e.textContent.includes('…')).length);
    assert.ok(shown >= 6, `on a phone at least six labels are whole (${shown})`);
    const h0 = (await page.locator('#chart').boundingBox()).height;
    await page.locator('#zoom-in').tap(); await page.locator('#zoom-in').tap(); await page.waitForTimeout(200);
    const h1 = (await page.locator('#chart').boundingBox()).height;
    assert.ok(Math.abs(h1 / h0 - 2.25) < 0.05, `two taps on + make the chart 2,25 times taller (${h1 / h0})`);
    assert.match(page.url(), /z=2\.3/, 'the zoom is in the address');
    assert.match(await page.textContent('#zoom-level'), /225/);
    const shownZ = await page.locator('.chart .node .label').evaluateAll(els => els.filter(e => e.style.display !== 'none' && e.textContent).length);
    const all = await page.locator('.chart .node').count();
    assert.ok(shownZ >= all - 6, `zoomed, nearly every node has its label (${shownZ} of ${all})`);
    // Pinch: two fingers moving apart on the chart.
    const pinch = async (from, to) => page.evaluate(([from, to]) => { const el = document.querySelector('#chart'); const r = el.getBoundingClientRect(); const cy = Math.min(window.innerHeight - 100, Math.max(r.top + 100, 300));
      const fire = (type, d) => { const mk = (id, y) => new Touch({ identifier: id, target: el, clientX: 195, clientY: y }); const ts = type === 'touchend' ? [] : [mk(1, cy - d / 2), mk(2, cy + d / 2)]; el.dispatchEvent(new TouchEvent(type, { touches: ts, targetTouches: ts, changedTouches: [mk(1, cy - d / 2), mk(2, cy + d / 2)], bubbles: true, cancelable: true })); };
      fire('touchstart', from); return new Promise(res => { fire('touchmove', (from + to) / 2); requestAnimationFrame(() => { fire('touchmove', to); requestAnimationFrame(() => { fire('touchend', to); res(); }); }); }); }, [from, to]);
    await pinch(100, 200); await page.waitForTimeout(200);
    const h2 = (await page.locator('#chart').boundingBox()).height;
    assert.ok(Math.abs(h2 / h1 - 2) < 0.1, `a pinch that doubles the distance doubles the height (${h2 / h1})`);
    await page.locator('#zoom-reset').tap(); await page.waitForTimeout(200);
    assert.ok(Math.abs((await page.locator('#chart').boundingBox()).height - h0) < 1, 'the middle button comes back to the original size');
    assert.ok(await page.locator('#zoom-out').isDisabled(), 'nothing to reduce at 100 %');
    await page.locator('.chart .node[data-id="payeurs:S14"]').scrollIntoViewIfNeeded();
    await page.locator('.chart .node[data-id="payeurs:S14"] .bar').tap(); await page.waitForTimeout(300);
    const box = await page.locator('#details').boundingBox();
    assert.ok(box && box.y > 300, 'the details come up as a bottom sheet');
    await phone.close();
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS browser: the landing, the drill-down and its address, the levels, the details and their sources, the panels, the keyboard, the theme, a shared link, the phone and its zoom');
  } finally { await browserApp.close(); server.kill(); }
}
main().catch(error => { console.error(error); process.exit(1); });
