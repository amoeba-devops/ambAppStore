/* eslint-disable */
/* Fleet PWA service worker — combined push + cache handlers.
 *
 * Push (P4 transport):
 *   - listen on `push` → showNotification with payload shape from push.service.ts
 *   - listen on `notificationclick` → focus existing tab or open new one
 *
 * Cache (P5 PWA):
 *   - precache offline fallback + manifest + a couple icons (~5 KB)
 *   - /_next/static/* and /icons/*           → cache-first  (immutable)
 *   - same-origin HTML navigation             → network-first 3s, then offline.html
 *   - /api/v1/*                               → network-only (no stale data)
 *   - cross-origin (Google Maps embed etc.)   → bypass (browser default)
 *   - non-GET                                 → bypass
 *
 * Versioning: bump CACHE_VERSION on any breaking sw.js change. activate phase
 * deletes any cache whose name doesn't match the current version.
 *
 * Update flow: `Cache-Control: max-age=0, must-revalidate` (set in next.config)
 * forces the browser to re-fetch sw.js on every page load. Combined with
 * skipWaiting + clients.claim, users pick up new SWs without manual reload.
 *
 * basePath: we derive the scope from `self.registration.scope` so the same
 * file works whether the app is mounted at `/` (local, Render) or
 * `/app-car-manager-v2/` (staging Docker).
 */

const CACHE_VERSION = 'fleet-v1';
const SCOPE = new URL(self.registration.scope).pathname;
const BASE = SCOPE.endsWith('/') ? SCOPE : SCOPE + '/';

const OFFLINE_URL = BASE + 'offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  BASE + 'manifest.webmanifest',
  BASE + 'icons/icon-192.png',
];

const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      /* Precache best-effort — if one URL fails (e.g. icon missing in dev),
       * we don't want the whole install to abort. */
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/* ─── Push handler (P4 notifications) ─────────────────────────────────── */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  /** @type {{ title?: string, body?: string, url?: string, tag?: string }} */
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'CCMS', body: event.data.text() };
  }

  const title = payload.title || 'CCMS';
  const options = {
    body: payload.body || '',
    /* `tag` coalesces re-pushes for the same trip into one notification. */
    tag: payload.tag || 'ccms',
    /* `renotify` re-vibrates/re-sounds even when tag is unchanged — useful
     * when admin re-assigns a previously seen trip. */
    renotify: true,
    icon: BASE + 'icons/icon-192.png',
    data: { url: payload.url || BASE },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || BASE;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      /* Prefer to re-focus a tab already open at this URL. */
      for (const client of allClients) {
        if (client.url.endsWith(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      /* Otherwise open a new tab. */
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

/* ─── Fetch handler (P5 cache strategies) ─────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  /* Static immutable build assets (hashed filenames) — cache-first. */
  if (url.pathname.startsWith(BASE + '_next/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  /* Icons + manifest — cache-first too. */
  if (url.pathname.startsWith(BASE + 'icons/') || url.pathname === BASE + 'manifest.webmanifest') {
    event.respondWith(cacheFirst(req));
    return;
  }

  /* APIs — always network. Returning a stale JSON would make the UI lie. */
  if (url.pathname.startsWith(BASE + 'api/')) return;

  /* HTML navigation — network-first with timeout + offline fallback. */
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  /* Everything else (same-origin GET) — network-first, no caching to keep
   * the cache footprint predictable. */
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    /* Only cache successful, basic responses — opaque (CORS) or error
     * responses would poison the cache. */
    if (res && res.ok && res.type === 'basic') {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    /* Best-effort: if this was an icon and we have anything in cache, fall
     * back to it; otherwise let the failure bubble. */
    return cached || Response.error();
  }
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const networkPromise = fetch(req);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('nav-timeout')), NAV_TIMEOUT_MS),
    );
    const res = await Promise.race([networkPromise, timeoutPromise]);
    return res;
  } catch (err) {
    const cached = await cache.match(OFFLINE_URL);
    if (cached) return cached;
    /* If even the offline page isn't cached (very early in install lifecycle),
     * surface the network error rather than hanging. */
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}
