// Flux service worker: the code is precached by tag (bumped with every
// change), the shards of a release are kept as long as the index names
// that release, the index itself is always fetched fresh when online.
const TAG = 'flux-4';
const CODE = `flux-code-${TAG}`;
const DATA = 'flux-data';
const FILES = ['./', 'index.html', 'flux.css?v=' + TAG, 'flux.js?v=' + TAG, 'js/fr.js', 'js/model.js', 'js/view.js', 'js/layout.js', 'js/interpolate.js', 'js/store.js', 'js/url-state.js', 'js/data.js', 'js/scene.js', 'js/render-ribbons.js', 'js/render-nodes.js', 'js/ui/h.js', 'js/ui/panels.js', 'js/compact.js', 'js/search.js', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CODE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('flux-code-') && k !== CODE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.includes('/graph/r/')) {
    e.respondWith(caches.open(DATA).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res; }));
    return;
  }
  if (url.pathname.endsWith('/graph/index.json')) {
    e.respondWith(fetch(e.request).then(res => { caches.open(DATA).then(c => c.put(e.request, res.clone())); return res; }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then(hit => hit || fetch(e.request)));
});
