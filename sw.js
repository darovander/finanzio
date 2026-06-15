/* sw.js — Finanzio Service Worker v7
   Estrategia: network-first para JS/HTML, cache-first para fuentes */

const CACHE = 'finanzio-v7';
const FONT_CACHE = 'finanzio-fonts-v1';

// Solo cachear fuentes externas (no cambian)
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(FONT_CACHE).then(c =>
      Promise.allSettled(FONT_URLS.map(u => c.add(u)))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Fuentes: cache-first (no cambian nunca)
  if (url.hostname.includes('fonts.g') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(FONT_CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Archivos propios (JS, HTML, CSS, JSON, icons): SIEMPRE red primero
  if (url.hostname === self.location.hostname || url.protocol === 'chrome-extension:') {
    e.respondWith(
      fetch(e.request).then(res => {
        // Guardar copia fresca en cache
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        // Sin red: usar cache como fallback
        caches.match(e.request).then(cached => cached || caches.match('/index.html'))
      )
    );
    return;
  }

  // Todo lo demás: red directa
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
