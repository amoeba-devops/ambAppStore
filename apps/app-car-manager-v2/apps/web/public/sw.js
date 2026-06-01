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

/* Bumped to v3 to reclaim accumulated cache bloat: the previous static cache
 * name never changed across deploys, so every build's content-hashed
 * `_next/static/*` chunks piled up forever (they can never be re-requested
 * once the hash changes). The `activate` handler nukes any cache whose name
 * isn't in `keep`, so this bump one-time-clears the old `fleet-v2` caches. */
const CACHE_VERSION = 'fleet-v3';
const TRIP_CACHE = CACHE_VERSION + '-trips';
/* `_next/static/*` lives in its own cache so the size cap can trim it WITHOUT
 * risking the precached offline.html / manifest / icons (which share
 * CACHE_VERSION and must never be evicted). */
const STATIC_CACHE = CACHE_VERSION + '-static';
const SCOPE = new URL(self.registration.scope).pathname;
const BASE = SCOPE.endsWith('/') ? SCOPE : SCOPE + '/';

/* Storage caps — keep Cache Storage bounded regardless of how many deploys
 * ship or how many trips a driver opens. `trimCache` evicts oldest-inserted
 * entries (Cache API preserves insertion order in `keys()`) once the count
 * exceeds the cap. A cache miss after eviction just re-fetches from network
 * (we only cache GET assets / navigations), so trimming is always safe. */
const MAX_STATIC_ENTRIES = 80;
const MAX_TRIP_ENTRIES = 12;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  /* Delete from the front (oldest) until we're back under the cap. */
  const excess = keys.length - maxEntries;
  await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)));
}

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
      /* Keep the precache, the static-chunk cache, and the trip-detail cache;
       * nuke everything else (previous SW version's caches). */
      const keep = new Set([CACHE_VERSION, STATIC_CACHE, TRIP_CACHE]);
      await Promise.all(
        names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/* Push + notificationclick handlers live further down (the "Web Push
 * (REQ-20260520 H.6)" block). They were previously ALSO defined here, which
 * registered two listeners for each event — so a single push fired both and
 * the user saw a duplicate notification. Removed the older pair; the single
 * remaining pair below is the canonical one. */

/* ─── Fetch handler (P5 cache strategies) ─────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  /* Static immutable build assets (hashed filenames) — cache-first into the
   * size-capped static cache so old deploys' chunks can't accumulate. */
  if (url.pathname.startsWith(BASE + '_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE, MAX_STATIC_ENTRIES));
    return;
  }

  /* Icons + manifest — cache-first into the (tiny, untrimmed) precache. */
  if (url.pathname.startsWith(BASE + 'icons/') || url.pathname === BASE + 'manifest.webmanifest') {
    event.respondWith(cacheFirst(req, CACHE_VERSION));
    return;
  }

  /* APIs — always network. Returning a stale JSON would make the UI lie. */
  if (url.pathname.startsWith(BASE + 'api/')) return;

  /* HTML navigation — network-first with timeout + offline fallback. */
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    /* Trip detail (`/trips/<uuid>`) gets a richer strategy: still network-
     * first, but ALSO write successful responses into a separate trip cache.
     * If the network later fails (driver enters a parking garage / loses
     * coverage on a route), the same URL serves from cache instead of the
     * generic offline.html. Most drivers re-open the trip they're already
     * working — caching the last few they touched is the sweet spot.
     *
     * Pattern: `/trips/{anything-with-no-slash}` (excludes `/trips`,
     * `/trips/new`, `/trips/[id]/edit`). */
    const isTripDetail = /^\/trips\/[^/]+\/?$/.test(url.pathname.slice(BASE.length - 1));
    if (isTripDetail) {
      event.respondWith(networkFirstWithCache(req, TRIP_CACHE));
      return;
    }
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  /* Everything else (same-origin GET) — network-first, no caching to keep
   * the cache footprint predictable. */
});

async function cacheFirst(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    /* Only cache successful, basic responses — opaque (CORS) or error
     * responses would poison the cache. */
    if (res && res.ok && res.type === 'basic') {
      await cache.put(req, res.clone());
      /* Enforce the size cap after each insert (no-op when uncapped). */
      if (maxEntries) void trimCache(cacheName, maxEntries);
    }
    return res;
  } catch (err) {
    /* Best-effort: if this was an icon and we have anything in cache, fall
     * back to it; otherwise let the failure bubble. */
    return cached || Response.error();
  }
}

/* Network-first WITH cache write-through. Used for trip detail pages so the
 * driver can re-open a recently viewed trip while offline. Differs from
 * `networkFirstNavigation` in two ways:
 *   1. Successful responses are cloned into `cacheName` for next time
 *   2. Cache fallback returns the same URL's cached body instead of
 *      offline.html, so the driver actually sees the trip they expected
 *
 * Cache eviction: bounded to the last MAX_TRIP_ENTRIES viewed trips via
 * `trimCache` after each successful write, so the cache can't grow without
 * limit no matter how many trips a driver opens over the SW's lifetime. */
/* ───────────────────────── Web Push (REQ-20260520 H.6) ───────────────────── */

self.addEventListener('push', (event) => {
  /* Payload is the JSON string we sent from push.service.ts. Defensive
   * parse — if a different sender ever pushes plain text we still show
   * something instead of crashing the SW. */
  let data = { title: 'Fleet', body: '', url: '/today', tag: 'fleet-default' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    if (event.data) data.body = event.data.text();
  }

  /* `requireInteraction: false` lets iOS PWA auto-dismiss notifications;
   * driver scenario is "glance + tap or ignore", not "dismiss explicitly". */
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      data: { url: data.url },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/today';
  const absolute = new URL(targetUrl, self.location.origin).href;

  /* Focus an already-open window scoped to our SW first; only open a fresh
   * one as fallback. On iPhone PWA this means tapping a push keeps the user
   * in the installed app instead of spawning a new Safari window. */
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(absolute);
            } catch {
              /* Some browsers disallow cross-document navigate from SW; ignore. */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(absolute);
    })(),
  );
});

async function networkFirstWithCache(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      /* Don't await — the response goes to the page immediately, the cache
       * write + trim finish in the background. The trim keeps only the last
       * ~12 viewed trips so this cache can't grow unbounded. */
      cache
        .put(req, res.clone())
        .then(() => trimCache(cacheName, MAX_TRIP_ENTRIES))
        .catch(() => {});
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    /* Fall back to the generic offline page if even the trip wasn't cached. */
    const fallback = await caches.open(CACHE_VERSION).then((c) => c.match(OFFLINE_URL));
    return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
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
