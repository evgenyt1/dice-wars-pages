/* Dicefront offline service worker.
 * pwa/vite-plugin.ts prepends VERSION and PRECACHE and emits this as sw.js.
 * Paths resolve against the registration scope, so the same worker serves "/"
 * (Sites) and a subpath (GitHub Pages). Build files are cache-first; the page
 * shell is network-first so an online launch receives the newest deployment. */
const CACHE = `dicefront-${VERSION}`;
const SCOPE = self.registration.scope;
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE.map(
            (path) => new Request(new URL(path, SCOPE), { cache: 'reload' }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('dicefront-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Server component payloads are live server responses, never an offline asset.
  if (request.headers.has('RSC') || url.searchParams.has('_rsc')) return;
  if (request.mode === 'navigate') event.respondWith(navigate(event, url));
  else event.respondWith(asset(event));
});

async function navigate(event, url) {
  const cache = await caches.open(CACHE);
  const page = url.origin + url.pathname;
  const shell = page === SCOPE || page === `${SCOPE}index.html`;
  const cached = () =>
    cache.match(SCOPE, { ignoreSearch: true, ignoreVary: true });
  const network = fetch(event.request).then(async (response) => {
    if (response.ok && shell) await cache.put(SCOPE, response.clone());
    return response;
  });
  event.waitUntil(network.catch(() => undefined));
  let timer;
  try {
    // A weak connection falls back to the cached shell instead of a blank launch.
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, NAVIGATION_TIMEOUT_MS);
    }).then(async () => (await cached()) ?? network);
    return await Promise.race([network, timeout]);
  } catch {
    return (await cached()) ?? Response.error();
  } finally {
    clearTimeout(timer);
  }
}

async function asset(event) {
  const cache = await caches.open(CACHE);
  // Hashed build files have no query; public URLs carry ?v= markers that
  // VERSION already covers, so the cached copy matches either way.
  const cached = await cache.match(event.request, {
    ignoreSearch: true,
    ignoreVary: true,
  });
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.status === 200 && response.type === 'basic')
    event.waitUntil(cache.put(event.request, response.clone()));
  return response;
}
