'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { OpenInMapsLink } from './open-in-maps-link';

interface MapRouteProps {
  pickup: string;
  dropoff: string;
  stopovers?: string[];
  /** Tailwind h-* class for the map container. Mobile-first responsive sizing
   *  by default (240/360/420px breakpoints). */
  heightClassName?: string;
  /** Show "Open in Google Maps" link in the header. */
  showFullscreenLink?: boolean;
  /** Wrapper className — caller controls top margin. */
  className?: string;
}

/* Module-level cache so multiple instances share one script load.
 * @googlemaps/js-api-loader v2 uses functional API: setOptions() once, then
 * importLibrary(name) on demand. The first importLibrary call boots the script. */
let loaderPromise: Promise<{
  maps: google.maps.MapsLibrary;
  routes: google.maps.RoutesLibrary;
}> | null = null;

const LOAD_TIMEOUT_MS = 12_000;

/* Google Maps signals auth failures (invalid key, billing disabled, referrer
 * not allowed) via this global callback instead of rejecting importLibrary —
 * without it the spinner would hang forever. We install once and let any
 * pending load reject so the UI flips to the error state. */
let authFailed = false;
const authFailureListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    authFailed = true;
    loaderPromise = null;
    authFailureListeners.forEach((fn) => fn());
  };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function getLoader(apiKey: string) {
  if (authFailed) return Promise.reject(new Error('Google Maps auth failed'));
  if (loaderPromise) return loaderPromise;
  setOptions({ key: apiKey, v: 'weekly', language: 'vi', region: 'VN' });
  const load = Promise.all([importLibrary('maps'), importLibrary('routes')]).then(
    ([maps, routes]) => ({ maps, routes }),
  );
  /* Race against a timeout so a hung script fetch (adblocker, network, bad key
   * that never errors) doesn't leave us spinning indefinitely. */
  loaderPromise = withTimeout(load, LOAD_TIMEOUT_MS, 'Google Maps load').catch((e) => {
    /* Reset so a remount can retry instead of inheriting the rejection forever. */
    loaderPromise = null;
    throw e;
  });
  return loaderPromise;
}

/**
 * Interactive Maps JavaScript API renderer with precise fit-bounds.
 * Unlike the Embed iframe (`MapPreview`), this version uses DirectionsService
 * to compute the actual driving polyline, then `map.fitBounds()` with explicit
 * padding so the viewport hugs the route exactly — solves the "zoomed too wide"
 * complaint with Embed mode.
 *
 * Cost note: Maps JS dynamic load is ~$7/1000 (well within the $200 free tier
 * for low-traffic apps). Directions API is ~$5/1000 routes. Falls back to a
 * neutral placeholder when no API key is configured.
 */
export function MapRoute({
  pickup,
  dropoff,
  stopovers = [],
  heightClassName = 'h-[240px] md:h-[360px] lg:h-[440px]',
  showFullscreenLink = false,
  className,
}: MapRouteProps) {
  const t = useTranslations('map');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /* Stable serialization for stopovers — array identity changes every parent
   * render which would otherwise re-run the effect needlessly. */
  const stopoverKey = stopovers.join('|');

  const fullscreenRoute = (() => {
    const p = pickup.trim();
    const d = dropoff.trim();
    if (p.length < 3 || d.length < 3) return null;
    return { origin: p, dest: d, waypoints: stopovers.map((s) => s.trim()).filter(Boolean) };
  })();

  useEffect(() => {
    if (!apiKey || !mapDivRef.current) return;
    const p = pickup.trim();
    const d = dropoff.trim();
    if (p.length < 3 || d.length < 3) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    /* If Google fires gm_authFailure mid-load, flip to error immediately
     * instead of waiting for the (never-rejecting) importLibrary promise. */
    const onAuthFailure = () => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
    };
    authFailureListeners.add(onAuthFailure);

    (async () => {
      try {
        await getLoader(apiKey);
        if (cancelled || !mapDivRef.current) return;

        /* Lazy-create map + renderer once, reuse on prop changes. */
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapDivRef.current, {
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'cooperative',
            clickableIcons: false,
          });
          rendererRef.current = new google.maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: false,
            preserveViewport: false,
            polylineOptions: {
              strokeColor: '#3182f6',
              strokeWeight: 5,
              strokeOpacity: 0.9,
            },
          });
        }

        const directionsService = new google.maps.DirectionsService();
        const waypoints = stopovers
          .map((s) => s.trim())
          .filter(Boolean)
          .map((location) => ({ location, stopover: true }));

        const result = await withTimeout(
          directionsService.route({
            origin: p,
            destination: d,
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            region: 'VN',
          }),
          LOAD_TIMEOUT_MS,
          'Directions request',
        );

        if (cancelled) return;

        rendererRef.current!.setDirections(result);

        /* Fit bounds with explicit padding so the route hugs the viewport
         * tightly with a small margin — solves Embed's "too zoomed out" feel. */
        const bounds = result.routes[0]?.bounds;
        if (bounds && mapRef.current) {
          mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        }

        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('MapRoute load failed:', e);
        setError(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      authFailureListeners.delete(onAuthFailure);
    };
  }, [apiKey, pickup, dropoff, stopoverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey) return null;

  return (
    <div className={className ?? ''}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-text-muted">{t('previewTitle')}</div>
        {showFullscreenLink && fullscreenRoute && (
          <OpenInMapsLink
            origin={fullscreenRoute.origin}
            dest={fullscreenRoute.dest}
            waypoints={fullscreenRoute.waypoints}
          />
        )}
      </div>
      <div className="relative rounded-md overflow-hidden border border-border bg-surface-2">
        <div ref={mapDivRef} className={`w-full ${heightClassName}`} />
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2/80 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2 px-4 text-center">
            <AlertTriangle className="h-5 w-5 text-text-faint" aria-hidden="true" />
            <div className="text-xs text-text-muted">{t('errorLoad')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
