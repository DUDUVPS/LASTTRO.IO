const CACHE_NAME = 'lasttro-pwa-v3';
const APP_SHELL = [
  '/',
  '/app',
  '/index.html',
  '/apresentacao.html',
  '/offline.html',
  '/styles.css',
  '/presentation.css',
  '/app.js',
  '/manifest.webmanifest',
  '/assets/logo-nome.png',
  '/assets/logotipo.ico',
  '/assets/favicon-32.png',
  '/assets/app-icon-192.png',
  '/assets/app-icon-512.png',
  '/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== location.origin || requestUrl.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => {
        if (event.request.mode === 'navigate') return caches.match('/offline.html');
        return caches.match(event.request).then(cached => cached || caches.match('/app'));
      })
  );
});

self.addEventListener('push', event => {
  let payload = {
    title: 'LASTTRO',
    body: 'Voce tem uma nova notificacao.',
    url: '/app',
    tag: 'lasttro-push'
  };

  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/assets/app-icon-192.png',
      badge: '/assets/favicon-32.png',
      tag: payload.tag,
      data: { url: payload.url || '/app' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => client.url.includes(targetUrl));
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
