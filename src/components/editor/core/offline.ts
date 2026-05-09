async function getDraftsideCacheStats() {
  if (!("caches" in window)) return {};

  const cacheNames = (await caches.keys()).filter((key) => key.startsWith("draftside-"));
  let cachedRequests = 0;
  let cachedBytes = 0;

  await Promise.all(
    cacheNames.map(async (cacheName) => {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      cachedRequests += requests.length;

      await Promise.all(
        requests.map(async (request) => {
          const response = await cache.match(request);
          if (!response) return;

          try {
            cachedBytes += (await response.clone().blob()).size;
          } catch {
            // Some opaque or partial responses may not expose a body size.
          }
        }),
      );
    }),
  );

  return {
    cacheCount: cacheNames.length,
    cachedRequests,
    cachedBytes,
  };
}

export { getDraftsideCacheStats };
