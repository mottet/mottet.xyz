'use strict';

// Every amount in the graph is an integer number of thousands of euros, so
// sums never drift. The sources come in euros (budget lines), millions
// (Eurostat, DREES, OFGL) or billions with three decimals (INSEE); toKeur
// rounds half to even at the thousand and refuses anything that is not a
// finite number, so a missing cell can never become a zero by accident.
const FACTORS = { EUR: 1e-3, KEUR: 1, MEUR: 1e3, MDEUR: 1e6 };

function roundHalfEven(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// toKeur(483.631, 'MDEUR') === 483631000 ; toKeur(3464537422, 'EUR') === 3464537
function toKeur(value, unitIn) {
  const factor = FACTORS[unitIn];
  if (!factor) throw new Error(`unknown unit ${unitIn}`);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`not a number: ${JSON.stringify(value)}`);
  // Scale in decimal first so 483.631 * 1e6 does not become 483630999.99999994.
  const scaled = Number((value * factor).toPrecision(15));
  const sign = scaled < 0 ? -1 : 1;
  return sign * roundHalfEven(Math.abs(scaled));
}

// French figures in text: "1 234,5" -> 1234.5 ; "N.D." -> null ; anything else throws.
function parseFr(text) {
  if (typeof text === 'number') return text;
  const t = String(text).replace(/[   ]/g, '').trim();
  if (/^(n\.?d\.?|nd|-|–|ns|n\.s\.|nc|)$/i.test(t)) return null;
  if (!/^[+-]?\d+(,\d+)?$/.test(t)) throw new Error(`not a French figure: ${JSON.stringify(text)}`);
  return Number(t.replace(',', '.'));
}

module.exports = { toKeur, parseFr, roundHalfEven, FACTORS };
