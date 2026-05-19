/* UA-aware Google Maps URL builder.
 *
 * Goal: when the user is inside an installed PWA standalone window, tapping a
 * "Open in Maps" link should hand off to the native maps app instead of
 * launching a separate browser window (which breaks the PWA experience).
 *
 * Strategy per platform:
 *
 *   iOS Safari / iOS PWA
 *     comgooglemaps://?saddr=...&daddr=...&directionsmode=driving
 *     → Google Maps app picks up. If not installed, iOS shows "Cannot Open",
 *       so callers should pair the deep link with a visibility-based fallback
 *       (see `attachIosFallback`) that swaps to the https URL after ~2s.
 *
 *   Android Chrome / Android PWA
 *     geo:0,0?q=<dest>
 *     → Android intent picker offers every installed maps app (Google Maps,
 *       Waze, etc.). If none installed, Chrome handles it as a web search.
 *       waypoints aren't part of the geo: URI standard, so they're ignored on
 *       Android (Google Maps app will still let the user add stops manually).
 *
 *   Desktop / unknown
 *     https://www.google.com/maps/dir/?api=1&...
 *     → opens maps.google.com in a new tab (existing behaviour).
 *
 * SSR-safe: `kind: 'web'` (https URL) is the default when no UA can be
 * detected, so server-rendered HTML always has a valid href the user can
 * still click before JS hydrates.
 */

export interface MapsLinkOpts {
  origin: string;
  dest: string;
  waypoints?: string[];
  /** navigator.userAgent — pass empty string for SSR. */
  ua: string;
}

export type MapsLink =
  | { kind: 'web'; url: string }
  | { kind: 'ios-app'; url: string; webFallback: string }
  | { kind: 'android-intent'; url: string; webFallback: string };

export function buildMapsLink(opts: MapsLinkOpts): MapsLink {
  const { origin, dest, waypoints = [], ua } = opts;

  const webParams = new URLSearchParams({
    api: '1',
    origin,
    destination: dest,
    travelmode: 'driving',
  });
  if (waypoints.length > 0) webParams.set('waypoints', waypoints.join('|'));
  const webUrl = `https://www.google.com/maps/dir/?${webParams.toString()}`;

  if (!ua) return { kind: 'web', url: webUrl };

  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    const params = new URLSearchParams({
      saddr: origin,
      daddr: dest,
      directionsmode: 'driving',
    });
    if (waypoints.length > 0) params.set('waypoints', waypoints.join('|'));
    return {
      kind: 'ios-app',
      url: `comgooglemaps://?${params.toString()}`,
      webFallback: webUrl,
    };
  }

  if (isAndroid) {
    return {
      kind: 'android-intent',
      url: `geo:0,0?q=${encodeURIComponent(dest)}`,
      webFallback: webUrl,
    };
  }

  return { kind: 'web', url: webUrl };
}

/* Attach an iOS fallback: if Google Maps isn't installed, the comgooglemaps://
 * URL silently does nothing — the page stays foreground. Detect that by
 * watching for `visibilitychange` (would fire to 'hidden' if the maps app
 * opened) within a short window, and otherwise navigate to the https URL.
 *
 * Returns a cleanup function the caller can invoke to detach early.
 */
export function attachIosFallback(webFallback: string, timeoutMs = 2000): () => void {
  if (typeof document === 'undefined') return () => undefined;

  let cancelled = false;

  const onVisibility = () => {
    /* If the page went hidden, the deep link succeeded — abort the fallback. */
    if (document.visibilityState === 'hidden') cancelled = true;
  };
  document.addEventListener('visibilitychange', onVisibility);

  const timer = window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    if (cancelled) return;
    if (document.visibilityState === 'visible') {
      window.location.href = webFallback;
    }
  }, timeoutMs);

  return () => {
    cancelled = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
