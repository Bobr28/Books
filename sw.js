const CACHE_NAME = 'library-v1';
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
      return cache.addAll(STATIC_FILES);
    })
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
  
  // Для JSON файлов книг (books/*.json)
  if (url.pathname.includes('/books/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Онлайн: сохраняем в кэш и возвращаем
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Офлайн: берем из кэша
          return caches.match(event.request);
        })
    );
  } 
  // Для books-list.json
  else if (url.pathname === '/books-list.json') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
  // Для статических файлов
  else if (STATIC_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-books') {
    event.waitUntil(syncNewBooks());
  }
});

async function syncNewBooks() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Получаем актуальный список книг с сервера
    const response = await fetch('/books-list.json');
    const serverBooks = await response.json();
    
    // Получаем список уже кэшированных книг
    const cachedRequests = await cache.keys();
    const cachedBookFiles = cachedRequests
      .filter(req => req.url.includes('/books/') && req.url.endsWith('.json'))
      .map(req => {
        const parts = req.url.split('/');
        return parts[parts.length - 1];
      });
    
    // Загружаем новые книги
    const newBooks = serverBooks.filter(book => !cachedBookFiles.includes(book));
    
    for (const bookFile of newBooks) {
      const bookResponse = await fetch(`/books/${bookFile}`);
      if (bookResponse.ok) {
        await cache.put(`/books/${bookFile}`, bookResponse);
      }
    }
    
    // Обновляем books-list.json в кэше (на случай, если список изменился)
    const listResponse = await fetch('/books-list.json');
    if (listResponse.ok) {
      await cache.put('/books-list.json', listResponse);
    }
    
    // Сообщаем клиенту об обновлении (без уведомлений)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'BOOKS_UPDATED' });
    });
    
  } catch (error) {
    console.error('Sync failed:', error);
  }
  // В основном файле (например, index.html или main.js)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(registration => {
    // Проверяем обновления каждые 5 минут (или по событию)
    setInterval(() => {
      registration.update();
    }, 5 * 60 * 1000); // 300000 ms
  });

  // Слушаем события обновления
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload(); // Принудительно обновляем страницу
  });
}
 }
