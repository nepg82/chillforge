const CACHE_NAME = "chillforge-cache-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app-icons/app-icon-192.png",
  "./app-icons/app-icon-512.png",
  "./Tone.js"
];

// Install: Cache all assets cleanly
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell / same-origin assets, falling back to
// network. This keeps the beat generator fully playable offline once it
// has been loaded once.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Only cache successful, basic/opaque responses.
          if (
            response &&
            (response.status === 200 || response.type === "opaque")
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: for navigations, fall back to the
          // cached app shell so the app still opens.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
