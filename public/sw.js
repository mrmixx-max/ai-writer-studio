// Service Worker für Offline-Support (AI Writer Studio).
//
// Zweck: Die App startet auch ohne Serververbindung. Im Tauri-Desktop-Betrieb
// läuft das Frontend hinter tauri:// bzw. asset:// — dort sind Service Worker
// nicht verfügbar (Feature-Detection in registerSw()). Der SW hilft im
// Browser-Dev/Preview-Betrieb und für künftige Web-Builds.
//
// Strategie:
//   - Navigationsanfragen (index.html): network-first, mit Cache-Fallback.
//   - Statische Assets (JS/CSS/WASM/Bilder): cache-first — Dateinamen sind
//     gehasht, der Cache wird pro Deploy-Version neu aufgebaut.
//   - API-/LLM-Requests werden bewusst NICHT gecacht.

const CACHE_NAME = "ai-writer-studio-v1";
const PRECACHE_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Lokale LLM-/API-Endpunkte niemals cachen (Streams, private Daten).
  if (url.pathname.startsWith("/api") || url.port === "11434" || url.port === "1234") {
    return;
  }

  if (req.mode === "navigate") {
    // Network-first mit Cache-Fallback: Im Offline-Fall startet die App
    // trotzdem aus dem Cache.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached ?? caches.match(req.url)),
        ),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // Cache-first für gehashte Build-Assets.
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
