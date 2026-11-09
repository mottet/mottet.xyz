'use strict';

// Eurostat gov_10a_main for France: one value per (sector, na_item, year).
// Returns { get(sector, item, year) -> { value, status, dims } | null, items, sectors, years, updated }.
const { decode } = require('../lib/eurostat.cjs');

function parse(json) {
  const { records, updated } = decode(json);
  const map = new Map();
  const items = new Set(), sectors = new Set(), years = new Set();
  for (const r of records) {
    map.set(`${r.dims.sector}|${r.dims.na_item}|${r.dims.time}`, { value: r.value, status: r.status, dims: r.dims, label: r.labels.na_item });
    items.add(r.dims.na_item); sectors.add(r.dims.sector); years.add(Number(r.dims.time));
  }
  return {
    updated,
    items: Array.from(items).sort(), sectors: Array.from(sectors).sort(), years: Array.from(years).sort(),
    get: (sector, item, year) => map.get(`${sector}|${item}|${year}`) || null,
  };
}

module.exports = { parse };
