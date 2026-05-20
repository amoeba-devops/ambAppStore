'use client';

import { useEffect } from 'react';

/* Registers the service worker once on the client.
 *
 * Skip conditions:
 *   - inside an iframe (AMA passthrough): SW scope would be the iframe URL,
 *     which is not useful — installable PWA needs top-level navigation
 *   - non-production: avoids interfering with Next.js HMR / dev fast refresh
 *     (override with NEXT_PUBLIC_ENABLE_SW=true if you want to test SW locally)
 *   - serviceWorker API missing: older browsers, just no-op
 *
 * basePath: SW must live at the same path as `scope`, so for staging Docker
 * (basePath=/app-car-manager-v2) the URL becomes /app-car-manager-v2/sw.js.
 * Next.js does NOT auto-prefix asset URLs we construct in client code, so we
 * read the prefix from a NEXT_PUBLIC_BASE_PATH build-time inline.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.self !== window.top) return;
    if (!('serviceWorker' in navigator)) return;

    const enabledInDev = process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    const shouldRegister = process.env.NODE_ENV === 'production' || enabledInDev;

    if (!shouldRegister) {
      /* Dev mode without explicit opt-in: actively tear down any service
       * worker the user installed in a previous run (e.g. they once exported
       * NEXT_PUBLIC_ENABLE_SW=true, or installed the PWA from staging).
       *
       * Why this matters: a leftover SW with cache-first on `/_next/static/*`
       * will serve stale chunks from disk against a fresh dev rebuild. Module
       * IDs change between rebuilds, so webpack's `__webpack_require__` finds
       * a slot in the new chunk that points to nothing, and the resulting
       * `factory.call(...)` on `undefined` blows up at the first JSX render
       * (typically right here at `<SWRegister />` in layout). The user sees
       * "Cannot read properties of undefined (reading 'call')" with no obvious
       * cause until they unregister the SW manually.
       *
       * This block does that automatically — silent in the happy path, but
       * unblocks the page the moment the dev server reloads. */
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          /* Permissions / private mode — best-effort cleanup. */
        }
      })();
      return;
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const swUrl = `${basePath}/sw.js`;
    const scope = `${basePath}/`;

    navigator.serviceWorker
      .register(swUrl, { scope })
      .catch(() => {
        /* Register can fail in private-mode or with stricter cookie settings —
         * silent so we never block the app. */
      });
  }, []);

  return null;
}
