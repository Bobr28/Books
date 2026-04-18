const CACHE_NAME = 'library-v1.2.1'; // 👈 Обязательно изменил версию!
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

// Установка — кэшируем статические файлы
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

// Активация — чистим старые кэши
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

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // 1. Для JSON-файлов книг в корне (book1.json, book2.json, ...)
  if (pathname.match(/\/book\d+\.json$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(response => {
            // ✅ Кэшируем ТОЛЬКО успешные ответы (статус 200)
            if (response.ok) {
              console.log('✅ Кэширую книгу:', pathname);
              cache.put(event.request, response.clone());
            } else {
              console.warn('⚠️ Книга не найдена (404):', pathname);
            }
            return response;
          })
          .catch(error => {
            // Если сети нет — пробуем отдать из кэша
            console.log('📦 Офлайн, пробую кэш для:', pathname);
            return cache.match(event.request).then(cached => {
              return cached || new Response('Книга недоступна офлайн', { status: 404 });
            });
          });
      })
    );
    return;
  }

  // 2. Для books-list.json
  if (pathname === '/books-list.json') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              console.log('✅ Обновляю список книг');
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

  // 3. Для статических файлов — сначала кэш, потом сеть
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

  // 4. Для всего остального — только сеть (не кэшируем)
  event.respondWith(fetch(event.request));
});