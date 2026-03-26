const CACHE_NAME = 'tympaniq-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css?v=13',
  '/audio-engine.js?v=13',
  '/app.js?v=13',
  '/manifest.json',
  '/music/broadband-enrichment.mp3',
  '/music/alpha-binaural.mp3',
  '/music/mixed-enrichment.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for HTML/JS/CSS, cache-first for music/icons
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isAsset = url.pathname.endsWith('.mp3') || url.pathname.startsWith('/icons/');

  if (isAsset) {
    // Cache-first for large static assets
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
  } else {
    // Network-first for app code — always get latest
    e.respondWith(
      fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return resp;
      }).catch(() => caches.match(e.request))
    );
  }
});
