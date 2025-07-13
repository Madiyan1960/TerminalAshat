self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("v1").then(cache => {
      return cache.addAll([
        "/TerminalAshat/index.html",
        "/TerminalAshat/manifest.json",
        //"/TerminalAshat/service-worker.js", // Убедитесь, что сам SW тоже кешируется
        "/TerminalAshat/icons/icon-192x192.png",
        "/TerminalAshat/icons/icon-512x512.png",
        // Добавьте сюда все остальные статические файлы вашего приложения:
        "/TerminalAshat/style.css",
        "/TerminalAshat/script.js",
        // "/TerminalAshat/data/materials.json" (если это статический файл)
        // Иконки для iOS, если они отличаются от Android:
        "/TerminalAshat/icons/icon-180x180.png"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  // Проверка для запросов к продуктам (или другим динамическим данным)
  if (event.request.url.includes('/products')) { // Если /products - это API-запрос
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          // Кэшируем ответ для последующих запросов
          // Важно: проверяйте, что ответ валиден, прежде чем кешировать
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }
          return caches.open('v1').then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  } else {
    // Для всех остальных запросов используем стратегию "Cache, then Network" или "Cache-first"
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});

// Добавьте обработчик события 'activate' для очистки старых кэшей
self.addEventListener('activate', event => {
  const cacheWhitelist = ['v1']; // Текущая версия кэша
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Удаляем старые кэши
          }
        })
      );
    })
  );
});
