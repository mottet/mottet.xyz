'use strict';

// The Tableau économique d'ensemble: for one year, every operation with its
// Emplois (what each sector pays) on the left and its Ressources (what each
// sector receives) on the right. The two header rows give the sector codes
// and labels of the columns; two columns have no code: the taxes less
// subsidies on products (TAX) and goods and services (BS). Returns
// { year, ops: { CODE: { label, emplois: {S14: {value, cell}}, ressources: {...} } } }.
const { readXlsx, colLetters } = require('../lib/xlsx.cjs');

function parse(buf, year) {
  const wb = readXlsx(buf);
  const sheet = wb.sheet('TEE_COMPLET');
  if (!sheet) throw new Error(`TEE ${year}: no TEE_COMPLET sheet`);
  const rows = sheet.rows();
  const codes = rows[1], labels = rows[2];
  if (!String(codes[1] || '').includes(String(year))) throw new Error(`TEE ${year}: header says ${codes[1]}`);
  // Columns: Emplois from C up to the first "Total", Ressources from the next "Total" on.
  const cols = [];
  let side = 'emplois';
  for (let c = 2; c < labels.length; c++) {
    const label = labels[c];
    if (label === undefined) { if (side === 'emplois' && cols.some(x => x.code === 'TOTAL' && x.side === 'emplois')) side = 'ressources'; continue; }
    if (label === 'Ressources') break;
    let code = codes[c];
    if (!code) {
      if (/^Imp/.test(label)) code = 'TAX';
      else if (/^Biens/.test(label)) code = 'BS';
      else if (/^Total/.test(label)) code = 'TOTAL';
      else throw new Error(`TEE ${year}: column ${colLetters(c)} "${label}" unknown`);
    }
    cols.push({ c, code, label, side });
  }
  const ops = {};
  for (let r = 3; r < rows.length; r++) {
    const code = rows[r][0], label = rows[r][1];
    if (typeof code !== 'string' || !/^[A-Z]/.test(code) || typeof label !== 'string') continue;
    if (ops[code]) continue; // B9NF appears once; a repeated code (P51c) keeps its first row
    const op = { label: label.trim(), emplois: {}, ressources: {} };
    for (const col of cols) {
      const v = rows[r][col.c];
      if (typeof v === 'number') op[col.side][col.code] = { value: v, cell: `${colLetters(col.c)}${r + 1}` };
    }
    ops[code] = op;
  }
  return { year, sheet: sheet.name, columns: cols, ops };
}

module.exports = { parse };
