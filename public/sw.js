const CACHE_NAME = "exec-dashboard-cache-v1";
const urlsToCache = ["/", "/index.html", "/manifest.json"];

// Install SW
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate SW + remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch with network-first strategy
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// 🔄 Auto-update logic
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
