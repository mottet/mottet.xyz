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
  console.log('PASS unit: xlsx, csv, JSON-stat, pdf rows, units, provenance, the graph rules, the parsers and the server');
}

// Every figure in flux/graph: integers, provenance, splits, identities.
function data(dir = path.join(ROOT, 'flux', 'graph')) {
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const nodes = JSON.parse(fs.readFileSync(path.join(dir, index.shards.nodes), 'utf8'));
  const prov = JSON.parse(fs.readFileSync(path.join(dir, index.shards.provenance), 'utf8'));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const problems = [];
  for (const n of nodes) if (n.parent && !byId.has(n.parent)) problems.push(`node ${n.id}: parent missing`);
  for (const [id, r] of Object.entries(prov.records)) { if (!prov.sources[r.source]) problems.push(`prov ${id}: source missing`); if (!r.locator) problems.push(`prov ${id}: no locator`); }
  for (const s of Object.values(prov.sources)) for (const k of ['org', 'title', 'url', 'licence']) if (!s[k]) problems.push(`source ${s.id}: ${k} missing`);
  let edgesTotal = 0;
  for (const [key, file] of Object.entries(index.shards.edges)) {
    const edges = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const byEdge = new Map(edges.map(e => [e.id, e]));
    edgesTotal += edges.length;
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
      if (sum !== target && !parent.flags.includes('over-coverage')) problems.push(`${k}: children ${sum} ≠ parent ${target}`);
    }
    // Identity: what comes in (receipts, non-recoverable, borrowing) equals what goes out (expenses, non-recoverable).
    const roots = edges.filter(e => !e.parent && !e.alt && !e.flags.includes('intra'));
    const hubIn = roots.filter(e => e.to === 'S13').reduce((s, e) => s + e.keur, 0);
    const hubOut = roots.filter(e => e.from === 'S13').reduce((s, e) => s + e.keur, 0);
    if (hubIn !== hubOut) problems.push(`${key}: S13 in ${hubIn} ≠ out ${hubOut}`);
    const ctl = index.controls && index.controls[key];
    if (ctl && ctl.TE !== null) {
      const d995 = roots.filter(e => e.op === 'D995').reduce((s, e) => s + e.keur, 0);
      const te = (hubOut - d995) / 1000, tr = (hubIn - d995 - roots.filter(e => e.op === 'B9').reduce((s, e) => s + e.keur, 0)) / 1000;
      if (Math.abs(te - ctl.TE) / ctl.TE > 0.001) problems.push(`${key}: expenses ${te} vs Eurostat TE ${ctl.TE}`);
      if (Math.abs(tr - ctl.TR) / ctl.TR > 0.001) problems.push(`${key}: receipts ${tr} vs Eurostat TR ${ctl.TR}`);
    }
    const s13 = byId.get('S13').totals[key];
    if (!s13 || s13.in !== hubIn || s13.out !== hubOut) problems.push(`${key}: S13 totals ${JSON.stringify(s13)} vs roots ${hubIn}/${hubOut}`);
  }
  if (problems.length) { console.error(problems.slice(0, 40).join('\n')); throw new Error(`${problems.length} data problems`); }
  console.log(`PASS data: ${nodes.length} nodes, ${edgesTotal} edges over ${Object.keys(index.shards.edges).length} shards, every figure sourced and every split summing (release ${index.release})`);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find(a => a.startsWith('--')) || null;
  if (!only || only === '--unit') await unit();
  if (!only || only === '--data') data(args.includes('--dir') ? args[args.indexOf('--dir') + 1] : undefined);
  if (only === '--browser') console.log('browser check: not yet written');
}
main().catch(error => { console.error(error); process.exit(1); });
