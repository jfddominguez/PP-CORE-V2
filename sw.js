/* PP CORE V2 · caché para abrir rápido. Nunca guarda datos de Supabase. */
var CACHE = 'pp-core-v2-1';
var ARCHIVOS = ['./', './index.html', './styles.css', './cloud-config.js', './pp-v2.js', './logo-pp.png', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('./index.html'); }); }));
});
