const CACHE_NAME = 'library-v1.0.4';
const STATIC_FILES = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/manifest.json',
  '/books-list.json',
  '/launchericon-192x192.png',
  '/launchericon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🔄 Кэширую статические файлы...');
      return cache.addAll(STATIC_FILES).catch(err => {
        console.warn('⚠️ Не все статические файлы удалось закэшировать:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('🗑️ Удаляю старый кэш:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;

  if (pathname.match(/\/book\d+\.json$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            return cache.match(event.request).then(cached => {
              return cached || new Response('Книга недоступна офлайн', { status: 404 });
            });
          });
      })
    );
    return;
  }

  if (pathname === '/books-list.json') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request))
          .then(cached => cached || new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
      })
    );
    return;
  }

  if (STATIC_FILES.includes(pathname) || pathname === '/' || pathname.endsWith('.html')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
