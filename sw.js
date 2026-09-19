/* ZippyTeach Ocean Board - offline support.
   Bump CACHE_NAME whenever you upload a new index.html, otherwise installed
   copies keep serving the old board from their cache. */
const CACHE_NAME = 'ocean-board-v13';

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

/* The board page itself is fetched fresh whenever there is internet, so a new
   upload reaches teachers the next time they open it. If the internet is slow
   or down (common in classrooms), the saved copy is used after a few seconds.
   Pictures and other files still come straight from the saved copy. */
const PAGE_WAIT_MS = 3500;

function isBoardPage(req) {
  if (req.mode === 'navigate') return true;
  const path = new URL(req.url).pathname;
  return path.endsWith('/') || path.endsWith('/index.html');
}

function pageNetworkFirst(event) {
  const req = event.request;
  const fromNetwork = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
    }
    return res;
  });
  const fallback = () => caches.match(req).then((hit) => hit || caches.match('./index.html'));
  const timeout = new Promise((resolve) => setTimeout(resolve, PAGE_WAIT_MS));
  return Promise.race([fromNetwork.catch(() => null), timeout]).then((res) => {
    if (res && res.ok) return res;
    // slow or offline: show the saved board now; the fresh copy still lands in the cache
    return fallback().then((hit) => hit || fromNetwork);
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (isBoardPage(event.request)) {
    event.respondWith(pageNetworkFirst(event));
    return;
  }
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
