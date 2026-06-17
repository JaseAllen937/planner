// AgendaAI service worker.
// BUMP THIS VERSION when you ship changes, otherwise the iPhone keeps the
// old cached files forever.
const VERSION = 'v8';
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
