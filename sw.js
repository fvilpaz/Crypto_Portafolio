const CACHE_NAME = 'mi-cartera-v8';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/modelo.js',
  './js/app.js',
  './js/fx.js',
  './js/mercado.js',
  './gestor.html',
  './js/gestor.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/etf/ishares.svg',
  './icons/etf/vanguard.svg',
  './icons/etf/xtrackers.svg',
  './icons/etf/invesco.svg',
  './icons/etf/amundi.svg',
  './icons/etf/vaneck.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first para el shell: cuando hay red, SIEMPRE se baja la versión más
// nueva (así un deploy llega a todo el mundo a la primera visita, sin servir
// código viejo de la caché). La caché solo se usa si la red falla (offline o
// servidor caído). Los cambios de app.js/html llegan al instante.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // deja pasar CDN + API externa

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        // no-cache = revalidar siempre con el servidor (304 si no hay cambios): GitHub Pages manda max-age=600 y, sin esto, un deploy tardaba hasta 10 min en verse
        const resp = await fetch(event.request, { cache: 'no-cache' });
        if (resp && resp.status === 200) cache.put(event.request, resp.clone());
        return resp;
      } catch (e) {
        const cached = await cache.match(event.request);
        return cached || Response.error();
      }
    })
  );
});
