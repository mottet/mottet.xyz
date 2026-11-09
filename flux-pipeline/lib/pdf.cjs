'use strict';

// Tables out of the budget PDFs (Voies et moyens, PLFSS annexes). poppler's
// `pdftotext -layout` keeps the columns aligned, one text line per table
// row, with form feeds between pages; rows are then matched by their label
// and the figures read right to left, so a row whose label wraps or whose
// columns move between editions fails loudly rather than silently.
const { spawnSync } = require('node:child_process');

function toText(file, { first, last } = {}) {
  const args = ['-layout', '-enc', 'UTF-8'];
  if (first) args.push('-f', String(first));
  if (last) args.push('-l', String(last));
  args.push(file, '-');
  const r = spawnSync('pdftotext', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`pdftotext failed: ${r.stderr || r.status}`);
  return r.stdout;
}

// pages(text) -> [{ page, lines }] (page numbers start at `first`, 1 by default)
function pages(text, first = 1) {
  return text.split('\f').map((p, i) => ({ page: first + i, lines: p.split('\n') }));
}

// A French figure in a budget table: "1 234,5", "-4,5", "+12,2", "n.s.", "-", "nd".
const FIG = /^[+-]?\d{1,3}(?:[   ]\d{3})*(?:,\d+)?$|^[+-]?\d+(?:,\d+)?$/;
function figure(token) {
  const t = token.replace(/\s+/g, ' ').replace(/\*+$/, '').trim();
  if (/^(-|–|—|n\.?s\.?|n\.?d\.?|nc|ε)$/i.test(t)) return null;
  if (!FIG.test(t)) return undefined;
  return Number(t.replace(/[   ]/g, '').replace(',', '.').replace(/^\+/, ''));
}

// Split a layout line into a label and the figures at its right end.
function splitRow(line) {
  const parts = line.trim().split(/\s{2,}/);
  const figures = [];
  // Figures are read from the right; a line of figures alone (a wrapped label) has no label left.
  while (parts.length > 0) {
    const f = figure(parts[parts.length - 1]);
    if (f === undefined) break;
    figures.unshift(f);
    parts.pop();
  }
  return { label: parts.join(' ').trim(), figures };
}

// findRow(lines, pattern, { columns }) -> { label, figures, line, index } or null
function findRow(lines, pattern, { columns, from = 0 } = {}) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(`^\\s*${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  for (let i = from; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    const row = splitRow(lines[i]);
    if (columns && row.figures.length < columns) continue;
    return { ...row, line: lines[i], index: i };
  }
  return null;
}

module.exports = { toText, pages, figure, splitRow, findRow };
