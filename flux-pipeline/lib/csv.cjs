'use strict';

// CSV for the open data portals: RFC 4180 quoting, a quoted field may hold
// newlines, the delimiter is detected from the header line (; or , or tab),
// a BOM is dropped. parseCsv() for a string, readCsv() to stream a big file
// row by row without holding it.
const fs = require('node:fs');

function detect(line) {
  const counts = [';', ',', '\t'].map(d => [d, (line.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) || []).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] ? counts[0][0] : ',';
}

// A streaming state machine; feed() returns completed rows, end() the last one.
function parser(delimiter) {
  let field = '', row = [], quoted = false, afterQuote = false, started = false;
  const rows = [];
  const push = () => { row.push(field); field = ''; afterQuote = false; };
  const line = () => { if (row.length || field.length || started) { push(); rows.push(row); row = []; } started = false; };
  const feed = chunk => {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (quoted) {
        if (ch === '"') { if (chunk[i + 1] === '"') { field += '"'; i++; } else { quoted = false; afterQuote = true; } }
        else field += ch;
        continue;
      }
      if (ch === '"' && field === '' && !afterQuote) { quoted = true; started = true; }
      else if (ch === delimiter) { push(); started = true; }
      else if (ch === '\n') { line(); }
      else if (ch === '\r') { /* \r\n */ }
      else { field += ch; started = true; }
    }
    const out = rows.splice(0);
    return out;
  };
  const end = () => { if (quoted) throw new Error('csv: unterminated quote'); if (field.length || row.length) line(); return rows.splice(0); };
  return { feed, end };
}

function parseCsv(text, { delimiter, header = true } = {}) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const d = delimiter || detect(text.split('\n', 1)[0]);
  const p = parser(d);
  const rows = p.feed(text).concat(p.end());
  if (!header) return rows;
  const [head, ...rest] = rows;
  return rest.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
}

// readCsv(file, onRow) streams; onRow(obj, index) may return a promise.
async function readCsv(file, onRow, { delimiter, encoding = 'utf8' } = {}) {
  const stream = fs.createReadStream(file, { encoding, highWaterMark: 1 << 20 });
  let p = null, head = null, n = 0, first = true;
  for await (let chunk of stream) {
    if (first) { if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1); first = false; }
    if (!p) {
      const nl = chunk.indexOf('\n');
      if (nl < 0 && chunk.length < 1 << 20) { chunk = chunk; }
      p = parser(delimiter || detect(nl < 0 ? chunk : chunk.slice(0, nl)));
    }
    for (const row of p.feed(chunk)) {
      if (!head) { head = row; continue; }
      await onRow(Object.fromEntries(head.map((h, i) => [h, row[i] === undefined ? '' : row[i]])), n++);
    }
  }
  if (p) for (const row of p.end()) {
    if (!head) { head = row; continue; }
    await onRow(Object.fromEntries(head.map((h, i) => [h, row[i] === undefined ? '' : row[i]])), n++);
  }
  return n;
}

module.exports = { parseCsv, readCsv, detect };
