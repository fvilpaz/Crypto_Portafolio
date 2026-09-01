const CACHE_NAME = 'mi-cartera-v5';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
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
  // Las funciones (proxy de precios) NUNCA se cachean en el SW: siempre a red,
  // para que los precios lleguen frescos y no sirvamos datos viejos.
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const resp = await fetch(event.request);
        if (resp && resp.status === 200) cache.put(event.request, resp.clone());
        return resp;
      } catch (e) {
        const cached = await cache.match(event.request);
        return cached || Response.error();
      }
    })
  );
});
