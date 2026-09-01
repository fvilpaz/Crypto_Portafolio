const CACHE_NAME = 'mi-cartera-v4';
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

// Stale-while-revalidate para el shell: responde al instante con la caché y en
// segundo plano baja la versión nueva para la próxima carga. Los cambios llegan
// al usuario sin borrar caché a mano. Chart.js (CDN) y la API de CoinGecko son
// cross-origin y se dejan pasar directas a red.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // deja pasar CDN + API externa
  // Las funciones (proxy de precios) NUNCA se cachean en el SW: siempre a red,
  // para que su propia caché de CDN (60s) mande y no sirvamos precios viejos.
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const red = fetch(event.request).then((resp) => {
        if (resp && resp.status === 200) cache.put(event.request, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || red; // instantáneo si hay caché; si no, espera a la red
    })
  );
});
