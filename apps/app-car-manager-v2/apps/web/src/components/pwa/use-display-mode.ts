'use client';

import { useEffect, useState } from 'react';

export type DisplayMode = 'standalone' | 'browser';

/* Tells whether the page is being viewed inside an installed PWA
 * (homescreen icon → standalone window) or a regular browser tab.
 *
 * Detection sources:
 *   - `matchMedia('(display-mode: standalone)')` — Android Chrome, Desktop
 *     Chrome/Edge, iOS Safari 16.4+
 *   - `navigator.standalone` — legacy iOS Safari (still works on current iOS)
 *
 * SSR-safe: starts as `'browser'` and updates on mount, so server render
 * matches initial client render (no hydration warning).
 */
export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>('browser');

  useEffect(() => {
    const compute = (): DisplayMode => {
      if (typeof window === 'undefined') return 'browser';
      const mq = window.matchMedia('(display-mode: standalone)');
      const iosLegacy = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      return mq.matches || iosLegacy ? 'standalone' : 'browser';
    };

    setMode(compute());

    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = () => setMode(compute());
    /* Safari uses the deprecated addListener API; modern browsers expose
     * addEventListener. Cover both. */
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  return mode;
}
