self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("v1").then(cache => {
      return cache.addAll([
        "/Terminal/index.html",
        "/Terminal/manifest.json",
        "/Terminal/service-worker.js",
        "/Terminal/icons/icon-192x192.png",
        "/Terminal/icons/icon-512x512.png"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  // Проверка для запросов к продуктам (или другим динамическим данным)
  if (event.request.url.includes('/products')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          // Кэшируем ответ для последующих запросов
          return caches.open('v1').then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  } else {
    // Для всех остальных запросов используем обычную стратегию
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
