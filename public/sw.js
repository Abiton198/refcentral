const CACHE_NAME = "exec-dashboard-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/site.webmanifest",
  "/icons/epru-320x320.png"
];

// Install
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — ONLY CACHE GET REQUESTS
self.addEventListener("fetch", (e) => {
  const { request } = e;

  // BLOCK POST, PUT, DELETE FROM CACHING
  if (request.method !== "GET") {
    return; // ← This stops the error
  }

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone).catch(() => {});
        });
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// Auto-update
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});