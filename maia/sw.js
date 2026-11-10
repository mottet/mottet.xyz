'use strict';

// The service worker behind the reminders. It caches nothing and only shows
// what the server pushes, then opens the right tab when the note is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let note = {};
  try { note = event.data ? event.data.json() : {}; } catch { note = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(note.title || 'Maïa', {
    body: note.body || '', tag: note.tag || undefined, renotify: Boolean(note.tag),
    icon: '/icon-192.png?v=2', badge: '/icon-192.png?v=2', data: { url: note.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    if (open) return (open.navigate ? open.navigate(url) : Promise.resolve(open)).then(c => (c || open).focus()).catch(() => open.focus());
    return self.clients.openWindow(url);
  }));
});
