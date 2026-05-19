'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { OpenInMapsLink } from './open-in-maps-link';

interface MapPreviewProps {
  pickup: string;
  dropoff: string;
  /** Ordered stopovers between pickup and dropoff. Empty strings filtered out. */
  stopovers?: string[];
  /** Show the "Open in Google Maps" link below the iframe. */
  showFullscreenLink?: boolean;
  /** Override the inner wrapper className — caller controls top margin/spacing. */
  className?: string;
  /**
   * Tailwind classes applied to the iframe + placeholder. Defaults to mobile-
   * first responsive heights. Pass `h-full` (with a sized parent) for a sticky
   * sidebar layout that fills viewport height.
   */
  heightClassName?: string;
}

/**
 * Google Maps Embed (Directions mode) preview for trip pickup → stopovers → dropoff.
 * Uses the FREE Maps Embed API (no per-load charge — separate from Places API).
 *
 * Renders only when both pickup & dropoff have ≥3 chars and a key is configured.
 * Inputs are debounced 500ms so the iframe doesn't reload on every keystroke.
 *
 * Note on zoom: Embed API directions mode auto-fits the route — you can't pass
 * a `zoom` param. To get tighter framing, we just give the iframe more vertical
 * space (h-[240/360/420px] responsive) so auto-fit has room to breathe.
 */
export function MapPreview({
  pickup,
  dropoff,
  stopovers = [],
  showFullscreenLink = false,
  className,
  heightClassName = 'h-[240px] md:h-[360px] lg:h-[420px]',
}: MapPreviewProps) {
  const t = useTranslations('map');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

  const [debounced, setDebounced] = useState({ pickup, dropoff, stopovers });
  /* Stable serialization for the dependency — array identity changes every parent
   * render even when contents are equal, which would defeat the debounce. */
  const stopoverKey = stopovers.join('|');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced({ pickup, dropoff, stopovers });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff, stopoverKey]);

  const { embedSrc, mapsRoute } = useMemo(() => {
    const p = debounced.pickup.trim();
    const d = debounced.dropoff.trim();
    if (p.length < 3 || d.length < 3) return { embedSrc: null, mapsRoute: null };

    const waypoints = debounced.stopovers.map((s) => s.trim()).filter(Boolean);

    /* Embed iframe — needs API key. */
    let embed: string | null = null;
    if (apiKey) {
      const params = new URLSearchParams({
        key: apiKey,
        origin: p,
        destination: d,
        mode: 'driving',
      });
      if (waypoints.length > 0) params.set('waypoints', waypoints.join('|'));
      embed = `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
    }

    return { embedSrc: embed, mapsRoute: { origin: p, dest: d, waypoints } };
  }, [apiKey, debounced]);

  if (!apiKey) return null;

  return (
    <div className={className ?? 'mt-4'}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-text-muted">{t('previewTitle')}</div>
        {showFullscreenLink && mapsRoute && (
          <OpenInMapsLink
            origin={mapsRoute.origin}
            dest={mapsRoute.dest}
            waypoints={mapsRoute.waypoints}
          />
        )}
      </div>
      {embedSrc ? (
        <div className={`rounded-md overflow-hidden border border-border bg-surface-2 ${heightClassName}`}>
          <iframe
            src={embedSrc}
            title={t('previewTitle')}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block w-full h-full"
            allowFullScreen
          />
        </div>
      ) : (
        <div className={`rounded-md border border-dashed border-border bg-surface-2/40 px-4 flex items-center justify-center text-center text-xs text-text-faint ${heightClassName}`}>
          {t('previewHint')}
        </div>
      )}
    </div>
  );
}
