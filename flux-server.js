'use strict';

// flux.mottet.xyz: who pays what into the French public administrations and
// who receives what, with the State at the centre. A static site in flux/
// served by the same process as the house, mounted only for its own host
// names. The figures are JSON shards in flux/graph/, emitted by the pipeline
// in flux-pipeline/ (every number carries an official source). Nothing is
// written at run time.
const express = require('express');
const path = require('path');

const HOSTS = new Set(['flux.mottet.xyz', 'flux.localhost'].concat((process.env.FLUX_HOSTS || '').split(',').filter(Boolean)));

module.exports = function flux(options = {}) {
  const site = options.site || path.join(__dirname, 'flux');
  // FLUX_GRAPH lets a check serve a small fixture release instead of the real shards.
  const graph = options.graph || process.env.FLUX_GRAPH || path.join(site, 'graph');
  const bench = options.bench !== undefined ? options.bench : (process.env.FLUX_BENCH === '1' || process.env.NODE_ENV !== 'production');
  const router = express.Router();
  const isHost = req => HOSTS.has(req.hostname);

  router.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  router.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /bench/\n'));

  // The shards: the index is revalidated on every visit, a release never changes.
  router.get('/graph/index.json', (req, res, next) => { res.set('Cache-Control', 'no-cache'); next(); });
  router.use('/graph/r', express.static(path.join(graph, 'r'), { immutable: true, maxAge: '1y', index: false, fallthrough: true }));
  router.use('/graph', express.static(graph, { index: false, setHeaders: res => res.set('Cache-Control', 'no-cache') }));

  if (!bench) router.use('/bench', (req, res) => res.status(404).type('text/plain').send('Pas ici.'));

  // The site: html, css, js and the service worker are revalidated (ETag), so
  // a module import never runs stale; the ?v=flux-N tag on the entry files
  // and the service worker's cache name are bumped together on every change.
  router.use(express.static(site, {
    index: 'index.html',
    setHeaders: (res, file) => {
      if (/\.(html|js|css|webmanifest|json)$/.test(file) && !file.includes(`${path.sep}graph${path.sep}r${path.sep}`)) res.set('Cache-Control', 'no-cache');
    },
  }));
  router.use((req, res) => res.status(404).type('text/plain').send('Pas ici.'));

  const middleware = (req, res, next) => (isHost(req) ? router(req, res, next) : next());
  return { middleware, router, isHost, HOSTS, site, graph };
};

module.exports.HOSTS = HOSTS;
