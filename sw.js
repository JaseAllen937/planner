// AgendaAI service worker.
// BUMP THIS VERSION when you ship changes, otherwise the iPhone keeps the
// old cached files forever.
const VERSION = 'v51';
const CACHE = `agendaai-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Never intercept cloud-sync calls — they must always hit the network.
  const url = new URL(e.request.url);
  if (url.hostname.endsWith('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ---- Push notifications ----
// One bundled daily reminder. The server-side cron sends a payload
// { title, body, url } and a fixed tag so today's reminder replaces yesterday's.
self.addEventListener('push', (event) => {
  let data = { title: 'AgendaAI', body: 'You have items coming up.' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    try { if (event.data) data.body = event.data.text(); } catch {}
  }
  const url = (data.url && typeof data.url === 'string') ? data.url : './index.html?view=upcoming';
  event.waitUntil(
    self.registration.showNotification(data.title || 'AgendaAI', {
      body: data.body || '',
      tag: 'agendaai-daily',     // replace yesterday's notification instead of stacking
      renotify: true,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './index.html?view=upcoming';
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsArr) {
      if (c.url.includes(self.registration.scope) && 'focus' in c) {
        try { if ('navigate' in c) await c.navigate(targetUrl); } catch {}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
