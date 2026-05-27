// Minimal service worker: caches the app shell and serves an offline fallback
// for navigations. API requests always go to the network.
const CACHE = "macau-ev-v2";
const SHELL = ["/", "/login", "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return; // never cache API calls

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r ?? caches.match("/login"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
