/* eslint-disable */
/**
 * CCMS service worker — Web Push handler.
 *
 * Scope is set by where this file is served. Next.js public/ files inherit
 * the app's basePath, so on staging it's served at
 *   https://stg-apps.amoeba.site/app-car-manager-v2/sw.js
 * which limits scope to /app-car-manager-v2/* — exactly what we want.
 *
 * Payload shape (matches push.service.ts):
 *   { title: string, body: string, url: string, tag: string }
 *
 * Click behavior: focus an existing tab open at the target URL, otherwise
 * open a new tab. Avoids stacking duplicate tabs when the user clicks
 * multiple notifications.
 */

self.addEventListener('install', (event) => {
  /* Skip waiting so a freshly registered SW takes control immediately —
   * users don't need to close + reopen to enable push. */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  /* Claim uncontrolled clients (open tabs) so push fires for them too. */
  event.waitUntil(self.clients.claim());
});

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
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

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
