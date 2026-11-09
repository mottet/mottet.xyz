'use strict';

// The Insee tables 3.201 to 3.214: dépenses et recettes of one sub-sector,
// one row per operation, one column per year, in Md€. The row labels are the
// same in every table, so one map of label → item code serves them all. The
// parser returns { sector, items: { CODE: { year: { value, cell } } } }.
const { readXlsx, colLetters } = require('../lib/xlsx.cjs');

const SECTORS = { 3201: 'S13', 3202: 'S1311', 3203: 'S13111', 3204: 'S13112', 3205: 'S1313', 3206: 'S13131', 3207: 'S131311', 3208: 'S131312', 3209: 'S131313', 3210: 'S131314', 3211: 'S13132', 3212: 'S1314', 3213: 'S13141', 3214: 'S13142' };

// [section, regex, code]. Codes end in PAY or REC like Eurostat's.
const ROWS = [
  ['D', /^Consommation intermédiaire \(P2\)/, 'P2'],
  ['D', /^Rémunération des salariés \(D1\)/, 'D1PAY'],
  ['D', /^Autres impôts sur la production \(D29\)/, 'D29PAY'],
  ['D', /^Revenus de la propriété autres que les intérêts/, 'D4XD41PAY'],
  ['D', /^Impôts courants sur le revenu et le patrimoine \(D5\)/, 'D5PAY'],
  ['D', /^Intérêts \(D41\)/, 'D41PAY'],
  ['D', /^Prestations sociales autres que transferts sociaux en nature \(D62\)/, 'D62PAY'],
  ['D', /^Transferts sociaux en nature de produits marchands \(D632\)/, 'D632PAY'],
  ['D', /^Subventions \(D3\)/, 'D3PAY'],
  ['D', /^Transferts courants entre administrations publiques \(D73\)/, 'D73PAY'],
  ['D', /^Autres transferts courants \(D7 hors D73\)/, 'D7XD73PAY'],
  ['D', /^Transferts en capital à payer/, 'D9XPAY'],
  ['D', /^Formation brute de capital fixe \(P51g\)/, 'P51GPAY'],
  ['D', /^Autres acquisitions moins cessions d'actifs non financiers/, 'P5XNPPAY'],
  ['D', /^Total des dépenses/, 'TE'],
  ['D', /^dont \(a\) - Cotisations sociales imputées \(D122\)/, 'D122PAY'],
  ['D', /^dont \(b\) - Capitalisation de la production/, 'P12PAY'],
  ['D', /^dont \(c\) - Crédits d'impôts enregistrés en dépenses/, 'TCPAY'],
  ['D', /^Dépenses hors éléments imputés/, 'TEX'],
  ['R', /^Production des branches marchandes et ventes résiduelles \(P11\)/, 'P11REC'],
  ['R', /^Production pour emploi final propre \(P12\)/, 'P12REC'],
  ['R', /^Paiements partiels des ménages/, 'P131REC'],
  ['R', /^Autres subventions sur la production \(D39\)/, 'D39REC'],
  ['R', /^Intérêts \(D41\)/, 'D41REC'],
  ['R', /^Revenus de la propriété autres que les intérêts/, 'D4XD41REC'],
  ['R', /^Impôts sur la production et les importations \(D2\)/, 'D2REC'],
  ['R', /^Impôts courants sur le revenu et le patrimoine \(D5\)/, 'D5REC'],
  ['R', /^Impôts en capital à recevoir \(D91r\)/, 'D91REC'],
  ['R', /^Transferts de recettes fiscales\s+\(D733\)/, 'D733REC'],
  ['R', /^Cotisations sociales nettes \(D61\)/, 'D61REC'],
  ['R', /^Impôts et cotisations dus non recouvrables nets \(D995r\)/, 'D995REC'],
  ['R', /^Transferts courants entre administrations publiques\s+\(D73 hors D733\)/, 'D73XREC'],
  ['R', /^Autres transferts courants\s+\(D7 hors D73\)/, 'D7XD73REC'],
  ['R', /^Transferts en capital\s+\(D9r hors D91r, D995r\)/, 'D9XREC'],
  ['R', /^Total des recettes/, 'TR'],
  ['R', /^dont \(a\) - Cotisations sociales imputées \(D612\)/, 'D612REC'],
  ['R', /^dont \(c'\) - Crédits d'impôts enregistrés en recettes/, 'TCREC'],
  ['R', /^Recettes hors éléments imputés/, 'TRX'],
  ['S', /^Epargne brute \(B8g\)/, 'B8G'],
  ['S', /^Capacité \(\+\) ou besoin \(-\) de financement \(B9NF\)/, 'B9'],
];

function parse(buf, table) {
  const wb = readXlsx(buf);
  const sheet = wb.sheets[0];
  const rows = sheet.rows();
  const yearRow = rows.findIndex(r => r.some(v => typeof v === 'number' && v >= 1950 && v <= 2100 && Number.isInteger(v)));
  if (yearRow < 0) throw new Error(`table ${table}: no year row`);
  const years = rows[yearRow].map((v, i) => [v, i]).filter(([v]) => typeof v === 'number' && v >= 1950 && v <= 2100);
  const items = {};
  let section = null;
  for (let r = 0; r < rows.length; r++) {
    const label = rows[r].slice(0, 2).find(v => typeof v === 'string');
    if (!label) continue;
    const t = label.trim();
    if (/^DEPENSES$/.test(t)) { section = 'D'; continue; }
    if (/^RECETTES$/.test(t)) { section = 'R'; continue; }
    if (/^SOLDES$/.test(t)) { section = 'S'; continue; }
    const hit = ROWS.find(([s, re]) => s === section && re.test(t));
    if (!hit) continue;
    const code = hit[2];
    if (items[code]) throw new Error(`table ${table}: row ${code} twice`);
    items[code] = { label: t };
    for (const [year, c] of years) {
      const v = rows[r][c];
      const cell = `${colLetters(c)}${r + 1}`;
      if (typeof v === 'number') items[code][year] = { value: v, cell };
      else if (v === 'N.D.' || v === 'nd' || v === undefined) items[code][year] = { value: null, cell };
      else throw new Error(`table ${table}: ${code} ${year} is ${JSON.stringify(v)}`);
    }
  }
  for (const [, , code] of ROWS) if (!items[code] && !['TCPAY', 'TCREC', 'TEX', 'TRX', 'D122PAY', 'P12PAY', 'D612REC'].includes(code)) throw new Error(`table ${table}: row ${code} not found`);
  return { sector: SECTORS[table], table, sheet: sheet.name, years: years.map(y => y[0]), items };
}

module.exports = { parse, SECTORS, ROWS };
