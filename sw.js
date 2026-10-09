/* ============================================================================
   ЛЮКС-7 · SW.JS — Service Worker (оффлайн + установка как PWA).
   Кэширует статику, отдаёт из кэша при отсутствии сети.
   ============================================================================ */
'use strict';

var CACHE_NAME = 'lux7-v1';
var PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './ambient.css',
  './app.js',
  './ambient.js',
  './items.js',
  './roulette-fx.js',
  './games-fx.js',
  './extras.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return c.add(url).catch(function () { /* игнорируем 404 для необязательных */ });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('chrome-extension') === 0) return;

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetchPromise = fetch(e.request).then(function (resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
