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
    if (process.env.NODE_ENV !== 'production' && !enabledInDev) return;

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
