const CACHE_NAME = 'library-v1.1.0';
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// Активация — чистим старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
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
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Для books-list.json
  if (pathname === '/books-list.json') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Для статических файлов (с учётом query-параметров)
  if (STATIC_FILES.includes(pathname)) {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
    return;
  }

  // Для всего остального – стандартное поведение (не кэшируем)
});

// Фоновая синхронизация (опционально)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-books') {
    event.waitUntil(syncNewBooks());
  }
});

async function syncNewBooks() {
  try {
    const cache = await caches.open(CACHE_NAME);
    // Получаем актуальный список книг
    const response = await fetch('/books-list.json');
    const serverBooks = await response.json();

    // Получаем уже кэшированные книги (из корня)
    const cachedRequests = await cache.keys();
    const cachedBookFiles = cachedRequests
      .filter(req => req.url.match(/\/book\d+\.json$/))
      .map(req => {
        const parts = req.url.split('/');
        return parts[parts.length - 1];
      });

    // Загружаем новые книги
    const newBooks = serverBooks.filter(book => !cachedBookFiles.includes(book));
    for (const bookFile of newBooks) {
      const bookResponse = await fetch(`/${bookFile}`);  // ← исправлен путь
      if (bookResponse.ok) {
        await cache.put(`/${bookFile}`, bookResponse);
      }
    }

    // Обновляем books-list.json в кэше
    const listResponse = await fetch('/books-list.json');
    if (listResponse.ok) {
      await cache.put('/books-list.json', listResponse);
    }

    // Сообщаем клиенту об обновлении
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'BOOKS_UPDATED' });
    });
  } catch (error) {
    console.error('Sync failed:', error);
  }
}