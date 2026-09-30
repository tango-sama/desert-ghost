// Kill-switch service worker.
// The site no longer uses a service worker. Older visitors still have one
// registered from a previous build that serves stale, broken pages. This
// version self-destructs: it clears every cache, unregisters itself, and
// reloads any open tabs so they fall back to fresh network content.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var names = await caches.keys();
      await Promise.all(names.map(function (n) { return caches.delete(n); }));
      await self.registration.unregister();
      var clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (c) { c.navigate(c.url); });
    } catch (e) { /* best effort */ }
  })());
});

// Always go straight to the network; never serve from cache.
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
