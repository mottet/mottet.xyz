'use strict';

// Cached downloads for the pipeline. Every artefact lands in data/flux/raw/
// under its source id with a manifest line (url, date, sha256, bytes, etag),
// so a build is reproducible from the manifest alone and an old vintage is
// never overwritten: a changed file gets a new dated name beside the old one.
// `offline: true` returns the latest cached copy and never touches the
// network; otherwise a conditional request keeps the cached copy on 304.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');

const RAW = process.env.FLUX_RAW || path.join(__dirname, '..', '..', 'data', 'flux', 'raw');
const UA = 'flux.mottet.xyz pipeline (open data reuse)';
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const short = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const today = () => new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { return { entries: [] }; }
}
function writeManifest(dir, m) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 1) + '\n');
}
const latest = (m, key) => m.entries.filter(e => e.key === key).sort((a, b) => (a.retrieved < b.retrieved ? 1 : -1))[0] || null;

// A small gate so a portal never sees more than two requests at once.
let running = 0;
const queue = [];
async function gate(limit, fn) {
  if (running >= limit) await new Promise(r => queue.push(r));
  running++;
  try { return await fn(); } finally { running--; const next = queue.shift(); if (next) next(); }
}

async function request(url, headers, tries = 4) {
  let wait = 2000;
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, redirect: 'follow' });
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      if (i + 1 >= tries) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      const after = Number(res.headers.get('retry-after'));
      await sleep(after ? after * 1000 : wait);
      wait *= 2;
      continue;
    }
    return res;
  }
}

// fetchCached({ source, url, name?, ext?, headers?, offline? }) -> { file, sha256, bytes, retrieved, etag, fromCache, url }
async function fetchCached({ source, url, name, ext, headers = {}, offline = process.env.FLUX_OFFLINE === '1', limit = 2 }) {
  const dir = path.join(RAW, source);
  const manifest = readManifest(dir);
  const key = `${name || 'file'}-${short(url)}`;
  const have = latest(manifest, key);
  if (have && fs.existsSync(path.join(dir, have.file))) {
    if (offline) return { ...have, file: path.join(dir, have.file), fromCache: true };
  } else if (offline) {
    throw new Error(`offline and nothing cached for ${url} (${source}/${key})`);
  }
  return gate(limit, async () => {
    const cond = have && have.etag ? { 'if-none-match': have.etag } : {};
    const res = await request(url, { ...headers, ...cond });
    if (res.status === 304 && have) {
      have.checked = today();
      writeManifest(dir, manifest);
      return { ...have, file: path.join(dir, have.file), fromCache: true };
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${key}.part`);
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    const out = fs.createWriteStream(tmp);
    const body = Readable.fromWeb(res.body);
    body.on('data', chunk => { hash.update(chunk); bytes += chunk.length; });
    await pipeline(body, out);
    const digest = hash.digest('hex');
    const extension = ext || extFrom(url, res.headers.get('content-type'));
    if (have && have.sha256 === digest) {
      fs.unlinkSync(tmp);
      have.checked = today();
      if (res.headers.get('etag')) have.etag = res.headers.get('etag');
      writeManifest(dir, manifest);
      return { ...have, file: path.join(dir, have.file), fromCache: true };
    }
    const file = `${key}-${today()}-${digest.slice(0, 8)}${extension}`;
    fs.renameSync(tmp, path.join(dir, file));
    const entry = { key, url, file, sha256: digest, bytes, retrieved: today(), etag: res.headers.get('etag') || null, lastModified: res.headers.get('last-modified') || null, contentType: res.headers.get('content-type') || null };
    manifest.entries.push(entry);
    writeManifest(dir, manifest);
    return { ...entry, file: path.join(dir, file), fromCache: false };
  });
}

function extFrom(url, type) {
  const m = /\.(xlsx|xls|csv|json|pdf|zip|txt|xml)(\?|$)/i.exec(url);
  if (m) return `.${m[1].toLowerCase()}`;
  if (!type) return '.bin';
  if (type.includes('json')) return '.json';
  if (type.includes('csv')) return '.csv';
  if (type.includes('pdf')) return '.pdf';
  if (type.includes('spreadsheetml')) return '.xlsx';
  if (type.includes('zip')) return '.zip';
  if (type.includes('text')) return '.txt';
  return '.bin';
}

module.exports = { fetchCached, RAW, sha256, short, today, readManifest };
