// Service Worker: zeigt Push-Benachrichtigungen fürs Orga-Team an.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Jugendraum', body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Jugendraum', {
    body: data.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: data.tag, renotify: !!data.tag, data: { url: data.url || '/admin' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
// ---------- Offline: eigene Buchungen und die wichtigsten Seiten bleiben lesbar ----------
const PAGES = 'jr-seiten-v1', ASSETS = 'jr-dateien-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/offline.html', '/logo.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Seiten mit persönlichen Daten nur für Bucher zwischenspeichern, nie die Verwaltung oder Schnittstellen
const CACHE_PAGE = /^\/($|raum$|meine-buchungen|buchung\/[\w-]+$)/;
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/admin')) { // Verwaltung nie zwischenspeichern, ohne Netz aber freundlich hinweisen
    if (req.mode === 'navigate') event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok && CACHE_PAGE.test(url.pathname)) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(url.pathname, copy)); }
      return res;
    }).catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || caches.match('/offline.html')));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || /^\/(logo\.png|icon-\d+\.png|fotos\/)/.test(url.pathname)) {
    event.respondWith(caches.open(ASSETS).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
