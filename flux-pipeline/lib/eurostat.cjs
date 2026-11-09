'use strict';

// Eurostat's dissemination API answers JSON-stat 2.0: one flat `value` map
// keyed by the row-major index over the dimensions in `id`, with `size` the
// length of each. decode() turns it back into one record per value, with the
// codes and labels of every dimension, and `status` (p = provisional…).
const { fetchCached } = require('./fetch.cjs');

const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

function url(table, params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of [].concat(v)) q.append(k, String(x));
  q.set('format', 'JSON');
  q.set('lang', 'EN');
  return `${BASE}/${table}?${q.toString()}`;
}

function decode(json) {
  const ids = json.id, size = json.size;
  const dims = ids.map(id => {
    const cat = json.dimension[id].category;
    const codes = Object.entries(cat.index).sort((a, b) => a[1] - b[1]).map(e => e[0]);
    return { id, codes, labels: cat.label || {} };
  });
  const records = [];
  for (const [key, value] of Object.entries(json.value)) {
    let rest = Number(key);
    const rec = { value, status: json.status ? json.status[key] || null : null, dims: {}, labels: {} };
    for (let d = ids.length - 1; d >= 0; d--) {
      const i = rest % size[d];
      rest = Math.floor(rest / size[d]);
      rec.dims[ids[d]] = dims[d].codes[i];
      rec.labels[ids[d]] = dims[d].labels[dims[d].codes[i]] || dims[d].codes[i];
    }
    records.push(rec);
  }
  return { records, updated: json.updated, label: json.label, dims };
}

// table(source, code, params, { offline }) -> { records, updated, url, file, sha256, retrieved }
async function table(source, code, params, opts = {}) {
  const u = url(code, params);
  const got = await fetchCached({ source, url: u, name: code, ext: '.json', ...opts });
  const json = JSON.parse(require('node:fs').readFileSync(got.file, 'utf8'));
  if (json.error) throw new Error(`eurostat ${code}: ${JSON.stringify(json.error).slice(0, 300)}`);
  return { ...decode(json), url: u, file: got.file, sha256: got.sha256, retrieved: got.retrieved };
}

module.exports = { url, decode, table, BASE };
