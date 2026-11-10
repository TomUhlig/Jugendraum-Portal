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
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
