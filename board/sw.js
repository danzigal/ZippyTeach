/* ZippyTeach Ocean Board - offline support.
   Bump CACHE_NAME whenever you upload a new index.html, otherwise installed
   copies keep serving the old board from their cache. */
const CACHE_NAME = 'ocean-board-v8';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192-plain.png',
  './icons/icon-512-plain.png',
  './art/t-hand.png',
  './art/t-listen.png',
  './art/t-sit.png',
  './art/t-respect.png',
  './art/t-best.png',
  './art/t-homework.png',
  './art/t-nohw.png',
  './art/t-disrupt.png',
  './art/t-noclass.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll fails the whole install if one file is missing, so add them
      // one at a time and let any stragglers be fetched later
      .then((cache) => Promise.all(FILES.map((f) => cache.add(f).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) {
        // serve instantly from the cache, then quietly refresh it for next time
        fetch(event.request).then((res) => {
          if (res && res.ok) caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(event.request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
