// Service worker: a app abre sem rede (com os dados da última visita, que
// vivem no localStorage). Sobe a versão sempre que mudares index/style/app.
const CACHE_VERSION = 'v4';
const CACHE_NAME = `compras-${CACHE_VERSION}`;
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'apple-touch-icon.png', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // Supabase nunca passa pela cache

  // Rede primeiro (para as atualizações chegarem logo); cache só sem rede.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((r) => {
        if (r && r.status === 200) {
          const copia = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
