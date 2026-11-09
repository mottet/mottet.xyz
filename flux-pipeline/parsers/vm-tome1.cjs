'use strict';

// The "Évaluation des voies et moyens, tome I" annex of a finance bill: the
// State's receipts. From its text (pdftotext -layout) this takes the summary
// table of net receipts (income tax, corporate tax, energy excise, VAT,
// other taxes, non-tax receipts, total) and the two totals of prélèvements
// sur recettes (to local authorities, to the EU budget). Each row carries
// four figures: the last executed year, the current year's initial law,
// the current year revised, and the bill's year. Every figure keeps its
// page and line for provenance.
const { pages, findRow, splitRow } = require('../lib/pdf.cjs');

// The summary rows (Md€) and the receipt they are. The energy excise row
// wrapped onto three lines in the 2025 edition, so it is matched loosely.
const SUMMARY = [
  ['IR', /^\s*Impôt net sur le revenu\b/, 'Impôt net sur le revenu'],
  ['IS', /^\s*Impôt net sur les sociétés\b/, 'Impôt net sur les sociétés'],
  ['TICPE', /^\s*(Accises sur les énergies nettes|Taxe intérieure de consommation)/, 'Accises sur les énergies (ex-TICPE), nettes'],
  ['TVA', /^\s*Taxe sur la valeur ajoutée nette\b/, 'Taxe sur la valeur ajoutée nette'],
  ['AUTRES', /^\s*Autres recettes fiscales nettes\b/, 'Autres recettes fiscales nettes'],
  ['NONFISC', /^\s*Recettes non fiscales\b/, 'Recettes non fiscales'],
  ['TOTAL', /^\s*Recettes (totales )?de l.État\b/, "Recettes totales de l'État (nettes des remboursements et dégrèvements)"],
];
const PSR = [
  ['PSR-CT', /^\s*Prélèvements sur les recettes de l'État au profit des collectivités territoriales\s+\d/, "Prélèvements sur les recettes de l'État au profit des collectivités territoriales"],
  ['PSR-UE', /^\s*3201 – Prélèvement sur les recettes de l'État au profit du budget de l'Union européenne/, "Prélèvement sur les recettes de l'État au profit du budget de l'Union européenne"],
];

// parse(text, { edition: 2026 }) -> { edition, columns: { exec: 2024, lfi: 2025, revised: 2025, bill: 2026 }, rows: { IR: { label, page, line, exec, lfi, revised, bill, unit } } }
function parse(text, { edition }) {
  const columns = { exec: edition - 2, lfi: edition - 1, revised: edition - 1, bill: edition };
  const pgs = pages(text);
  const rows = {};
  const grab = (code, re, label, { unit, columnsNeeded, pick, optional = false }) => {
    for (const p of pgs) {
      const hit = findRow(p.lines, re, { columns: columnsNeeded });
      if (!hit) continue;
      // A wrapped label: the figures sit on the next line.
      const figs = hit.figures;
      const take = pick(figs);
      if (!take) continue;
      rows[code] = { label, page: p.page, line: hit.index + 1, unit, ...take };
      return true;
    }
    if (optional) return false;
    throw new Error(`voies et moyens ${edition}: row ${code} not found`);
  };
  // Summary: six figures (exec, LFI, revised, delta, bill, delta) in Md€; the energy row may be split over lines.
  for (const [code, re, label] of SUMMARY) {
    grab(code, re, label, { unit: 'MDEUR', columnsNeeded: 6, optional: code === 'TICPE', pick: f => (f.length >= 6 ? { exec: f[0], lfi: f[1], revised: f[2], bill: f[4] } : null) });
  }
  if (!rows.TICPE) {
    // 2025 edition: "Taxe intérieure de consommation" then the figures on the following line.
    for (const p of pgs) {
      const i = p.lines.findIndex(l => /^\s*Taxe intérieure de consommation\s*$/.test(l));
      if (i < 0) continue;
      const row = splitRow(p.lines[i + 1]);
      if (row.figures.length >= 6) { rows.TICPE = { label: SUMMARY[2][2], page: p.page, line: i + 2, unit: 'MDEUR', exec: row.figures[0], lfi: row.figures[1], revised: row.figures[2], bill: row.figures[4] }; break; }
    }
    if (!rows.TICPE) throw new Error(`voies et moyens ${edition}: row TICPE not found`);
  }
  for (const [code, re, label] of PSR) grab(code, re, label, { unit: 'KEUR', columnsNeeded: 4, pick: f => (f.length >= 4 ? { exec: f[0], lfi: f[1], revised: f[2], bill: f[3] } : null) });
  // Sanity: the summary adds up.
  const parts = ['IR', 'IS', 'TICPE', 'TVA', 'AUTRES', 'NONFISC'];
  for (const col of ['exec', 'lfi', 'revised', 'bill']) {
    const sum = parts.reduce((s, k) => s + rows[k][col], 0);
    if (Math.abs(sum - rows.TOTAL[col]) > 0.35) throw new Error(`voies et moyens ${edition}: ${col} parts ${sum.toFixed(1)} ≠ total ${rows.TOTAL[col]}`);
  }
  return { edition, columns, rows };
}

module.exports = { parse, SUMMARY, PSR };
