// Minimal service worker. The app shell is data-driven (SSR settings), so we
// deliberately do NOT cache "/" — navigations are always network-first, with
// the login page as the only offline fallback. This avoids serving a stale
// shell with out-of-date data baked in.
const CACHE = "macau-ev-v3";
const SHELL = ["/login", "/manifest.json", "/icons/icon-192.png"];

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
    // Always go to the network; fall back to the login shell only when offline.
    event.respondWith(fetch(request).catch(() => caches.match("/login")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
