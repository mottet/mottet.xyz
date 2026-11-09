'use strict';

// Where a number comes from. A provenance record names the publisher, the
// dataset, the exact locator (a cell, a query and group key, Eurostat
// dimensions, a PDF page and row, or a curated mapping file) and when it was
// retrieved. Edges refer to records by id; the registry writes them once.
const crypto = require('node:crypto');

const LICENCES = {
  LO2: 'Licence Ouverte 2.0 (Etalab)',
  CCBY4: 'CC BY 4.0',
  PARL: 'Document parlementaire (Assemblée nationale / Sénat)',
};

const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-|-$/g, '');

class Registry {
  constructor() { this.records = new Map(); this.sources = new Map(); }
  // A source is one dataset or document of one publisher.
  source(id, info) {
    const rec = { id, ...info };
    for (const k of ['org', 'title', 'url', 'licence']) if (!rec[k]) throw new Error(`source ${id}: ${k} missing`);
    if (!LICENCES[rec.licence]) throw new Error(`source ${id}: unknown licence ${rec.licence}`);
    this.sources.set(id, rec);
    return rec;
  }
  // prov(sourceId, locator, extra) -> id. Same locator, same id.
  prov(sourceId, locator, extra = {}) {
    const src = this.sources.get(sourceId);
    if (!src) throw new Error(`unknown source ${sourceId}`);
    const key = `${sourceId}:${JSON.stringify(locator)}`;
    const id = `${sourceId}:${crypto.createHash('sha1').update(key).digest('hex').slice(0, 10)}`;
    if (!this.records.has(id)) this.records.set(id, { id, source: sourceId, locator, ...extra });
    return id;
  }
  toJSON() {
    const sort = m => Object.fromEntries(Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    return { sources: sort(this.sources), records: sort(this.records) };
  }
}

module.exports = { Registry, LICENCES, slug };
