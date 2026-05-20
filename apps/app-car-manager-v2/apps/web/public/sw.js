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

/* Bumped to v2 when trip-detail offline cache was added (REQ-20260520 H.3).
 * The `activate` handler nukes any previous-version cache on upgrade. */
const CACHE_VERSION = 'fleet-v2';
const TRIP_CACHE = CACHE_VERSION + '-trips';
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
      /* Keep both the current static cache and the trip-detail cache; nuke
       * everything else (previous SW version's caches). */
      const keep = new Set([CACHE_VERSION, TRIP_CACHE]);
      await Promise.all(
        names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)),
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

/* Network-first WITH cache write-through. Used for trip detail pages so the
 * driver can re-open a recently viewed trip while offline. Differs from
 * `networkFirstNavigation` in two ways:
 *   1. Successful responses are cloned into `cacheName` for next time
 *   2. Cache fallback returns the same URL's cached body instead of
 *      offline.html, so the driver actually sees the trip they expected
 *
 * Cache eviction: passive — old entries naturally rotate out as new trips
 * are viewed. We could add explicit pruning (keep last N) but with ~5-10
 * trips/driver/day and tiny HTML payloads it's not worth the complexity. */
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
       * write can finish in the background. */
      cache.put(req, res.clone()).catch(() => {});
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
