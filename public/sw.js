self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));

self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request));
});

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch (_) {}

      try {
        const names = await caches.keys();
        await Promise.all(
          names.map((n) => caches.delete(n).catch(() => false)),
        );
      } catch (_) {}

      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map((client) => {
            try {
              const url = new URL(client.url);
              url.searchParams.set("sw-cleanup", Date.now().toString());
              return client.navigate(url.toString()).catch(() => null);
            } catch (_) {
              return Promise.resolve(null);
            }
          }),
        );
      } catch (_) {}

      try {
        await self.registration.unregister();
      } catch (_) {}
    })(),
  ),
);
