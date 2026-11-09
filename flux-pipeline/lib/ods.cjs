'use strict';

// Opendatasoft portals (data.economie.gouv.fr, data.ofgl.fr, the DREES and
// URSSAF portals): the Explore API v2.1. `records` is capped at a hundred
// rows and ten thousand of offset, so every bulk read goes through
// `exports`, which streams the whole selection and accepts the same
// `select`, `where`, `group_by` and `order_by`. Aggregating server side is
// how the seven-million-row balances become a few thousand sums.
const fs = require('node:fs');
const { fetchCached } = require('./fetch.cjs');

function client(base, source) {
  const api = `${base.replace(/\/$/, '')}/api/explore/v2.1/catalog/datasets`;
  const query = params => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    return q.toString();
  };
  const meta = async (dataset, opts = {}) => {
    const u = `${api}/${dataset}`;
    const got = await fetchCached({ source, url: u, name: `${dataset}-meta`, ext: '.json', ...opts });
    return { ...JSON.parse(fs.readFileSync(got.file, 'utf8')), _url: u, _file: got.file, _retrieved: got.retrieved, _sha256: got.sha256 };
  };
  // exportJson(dataset, { select, where, group_by, order_by, limit }) -> { rows, url, file, retrieved, sha256 }
  const exportJson = async (dataset, params = {}, opts = {}) => {
    const u = `${api}/${dataset}/exports/json?${query(params)}`;
    const got = await fetchCached({ source, url: u, name: `${dataset}-${params.group_by ? 'agg' : 'rows'}`, ext: '.json', ...opts });
    const rows = JSON.parse(fs.readFileSync(got.file, 'utf8'));
    if (!Array.isArray(rows)) throw new Error(`ods ${dataset}: ${JSON.stringify(rows).slice(0, 300)}`);
    return { rows, url: u, file: got.file, retrieved: got.retrieved, sha256: got.sha256 };
  };
  // exportCsv() only downloads; read it with csv.readCsv.
  const exportCsv = async (dataset, params = {}, opts = {}) => {
    const u = `${api}/${dataset}/exports/csv?${query({ delimiter: ';', ...params })}`;
    const got = await fetchCached({ source, url: u, name: `${dataset}-csv`, ext: '.csv', ...opts });
    return { url: u, file: got.file, retrieved: got.retrieved, sha256: got.sha256 };
  };
  return { base, api, meta, exportJson, exportCsv };
}

module.exports = { client };
