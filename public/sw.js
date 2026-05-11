const CACHE_VERSION = "draftside-2026-05-10.1";
const APP_CACHE = `${CACHE_VERSION}:app`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;
const DOCUMENTS = ["/", "/write"];
const STATIC_ASSETS = [
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-16.png",
  "/favicon-32.png",
  "/favicon-48.png",
  "/localwrite.svg",
  "/localwrite-180.png",
  "/localwrite-192.png",
  "/localwrite-512.png",
  "/fonts/inter/InterVariable.woff2",
  "/fonts/inter/InterVariable-Italic.woff2",
  "/fonts/geist-mono/GeistMono-Variable.woff2",
];

async function cacheResponse(cache, url, response) {
  if (!response || !response.ok) return;
  await cache.put(url, response.clone());
}

function assetUrlsFromHtml(html, baseUrl) {
  const urls = new Set();
  const pattern = /\b(?:href|src)=["']([^"']+)["']/g;
  let match;

  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === self.location.origin) {
        urls.add(url.pathname + url.search);
      }
    } catch {
      // Ignore malformed markup.
    }
  }

  return [...urls];
}

async function cacheDocumentWithAssets(cache, path) {
  const response = await fetch(path, { cache: "reload" });
  await cacheResponse(cache, path, response);
  const html = await response.clone().text();
  const urls = assetUrlsFromHtml(html, new URL(path, self.location.origin));
  await Promise.allSettled(urls.map((url) => cache.add(url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset)));
      await Promise.allSettled(DOCUMENTS.map((path) => cacheDocumentWithAssets(cache, path)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);
        try {
          const response = await fetch(request);
          await cacheResponse(cache, url.pathname, response);
          return response;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match("/write")) || (await cache.match("/"));
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const appCache = await caches.open(APP_CACHE);
      const cached = await appCache.match(request);
      if (cached) return cached;

      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const runtimeCached = await runtimeCache.match(request);
      const fetchAndCache = fetch(request).then(async (response) => {
        await cacheResponse(runtimeCache, request, response);
        return response;
      });

      return runtimeCached || fetchAndCache;
    })(),
  );
});
