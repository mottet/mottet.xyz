'use strict';

// A minimal reader for the .xlsx files INSEE and the DREES publish: the zip
// central directory, raw deflate, the shared strings and the cells of each
// sheet. No dependency; a few hundred rows per file. Dates and styles are
// ignored (the figures are plain numbers, the labels plain strings).
const zlib = require('node:zlib');

function entries(buf) {
  // End of central directory record, searched backwards (a comment may follow it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    out.set(name, { method, csize, usize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function read(buf, entry) {
  const p = entry.offset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('bad local header');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.csize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`zip method ${entry.method} not supported`);
}

const unescape = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const textOf = xml => unescape(Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g), m => m[1]).join(''));

function colIndex(letters) { let n = 0; for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; }
function colLetters(i) { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }

function parseSheet(xml, shared) {
  const cells = new Map();
  let maxRow = 0, maxCol = 0;
  for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
    const [, col, row, attrs, inner] = m;
    if (inner === undefined) continue;
    const type = /\bt="([^"]+)"/.exec(attrs);
    let value;
    if (type && type[1] === 's') { const v = /<v>([^<]*)<\/v>/.exec(inner); value = v ? shared[Number(v[1])] : ''; }
    else if (type && type[1] === 'inlineStr') value = textOf(inner);
    else if (type && (type[1] === 'str' || type[1] === 'e')) { const v = /<v>([^<]*)<\/v>/.exec(inner); value = v ? unescape(v[1]) : ''; }
    else if (type && type[1] === 'b') { const v = /<v>([^<]*)<\/v>/.exec(inner); value = v ? v[1] === '1' : null; }
    else { const v = /<v>([^<]*)<\/v>/.exec(inner); value = v ? Number(v[1]) : null; }
    if (value === null || value === undefined) continue;
    const r = Number(row), c = colIndex(col);
    cells.set(`${col}${row}`, value);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  const rows = () => {
    const out = [];
    for (let r = 1; r <= maxRow; r++) {
      const line = [];
      for (let c = 0; c <= maxCol; c++) line.push(cells.get(`${colLetters(c)}${r}`));
      out.push(line);
    }
    return out;
  };
  return { cells, maxRow, maxCol, get: ref => cells.get(ref), rows };
}

// readXlsx(buffer) -> { sheets: [{ name, cells, get, rows, maxRow, maxCol }], sheet(name) }
function readXlsx(buf) {
  const zip = entries(buf);
  const text = name => { const e = zip.get(name); if (!e) throw new Error(`${name} missing in workbook`); return read(buf, e).toString('utf8'); };
  const shared = zip.has('xl/sharedStrings.xml') ? Array.from(text('xl/sharedStrings.xml').matchAll(/<si>(.*?)<\/si>/gs), m => textOf(m[1])) : [];
  const rels = new Map(Array.from(text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s([^>]*)\/?>/g), m => {
    const id = /\bId="([^"]+)"/.exec(m[1]), target = /\bTarget="([^"]+)"/.exec(m[1]);
    return [id && id[1], target && target[1]];
  }));
  const sheets = Array.from(text('xl/workbook.xml').matchAll(/<sheet\s([^>]*)\/?>/g), m => {
    const name = /\bname="([^"]+)"/.exec(m[1]), rid = /\br:id="([^"]+)"/.exec(m[1]);
    let target = rels.get(rid && rid[1]) || '';
    if (target.startsWith('/')) target = target.slice(1); else if (!target.startsWith('xl/')) target = `xl/${target}`;
    return { name: unescape(name ? name[1] : ''), target };
  }).map(s => ({ name: s.name, ...parseSheet(text(s.target), shared) }));
  return { sheets, sheet: name => sheets.find(s => s.name === name) || null };
}

module.exports = { readXlsx, colIndex, colLetters, _zip: { entries, read } };
