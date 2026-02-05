// Service Worker - Mejorado con estrategia de caché inteligente
// Luz y Sombra: El Alba de Hispania

const CACHE_NAME = 'lys-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/animations.css',
  './js/utils.js',
  './js/audio.js',
  './js/combat.js',
  './js/map.js',
  './js/actions.js',
  './js/state.js',
  './js/ui.js',
  './js/game.js',
  './js/integrator.js',
  './js/constants.js',
  './js/events.js',
  './js/tutorial.js',
  './js/notifications.js',
  './js/achievements.js',
  './js/quests.js',
  './js/statistics.js',
  './audio1.mp3',
  './audioFight1.mp3',
  './audioFight2.mp3',
  './icon-192.svg',
  './icon-512.svg',
  './LOGO.jpg'
];

// Instalación - Cachear assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Cache failed:', err))
  );
});

// Activación - Limpiar cachés antiguas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - Estrategia: Cache First, Network Fallback
self.addEventListener('fetch', (event) => {
  // Solo cachear GET requests
  if (event.request.method !== 'GET') return;

  // Ignorar requests de chrome-extension y otros protocolos
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Retornar caché y actualizar en background
          updateCache(event.request);
          return cachedResponse;
        }

        // Si no está en caché, fetch de red
        return fetch(event.request)
          .then((response) => {
            // Solo cachear respuestas válidas
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clonar respuesta para cachear
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Fallback para páginas HTML
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Actualizar caché en background
function updateCache(request) {
  fetch(request)
    .then((response) => {
      if (!response || response.status !== 200) return;

      caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(request, response);
        });
    })
    .catch(() => {
      // Silently fail - ya tenemos caché
    });
}

// Mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
