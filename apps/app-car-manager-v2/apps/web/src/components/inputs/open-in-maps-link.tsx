'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, MapPin } from 'lucide-react';
import { attachIosFallback, buildMapsLink, type MapsLink } from '@/lib/maps-deep-link';

interface OpenInMapsLinkProps {
  origin: string;
  dest: string;
  waypoints?: string[];
}

/* "Open in Maps" affordance that adapts to the platform:
 *
 *   - SSR / unknown UA — emits the https web URL with target="_blank" so the
 *     link is always clickable even before hydration
 *   - Android — swaps href to `geo:0,0?q=<dest>` so the OS intent picker
 *     opens the user's preferred maps app
 *   - iOS — swaps href to `comgooglemaps://`. If Google Maps isn't installed,
 *     iOS keeps the page foreground — a fallback timer (set on click) then
 *     navigates the same tab to the https URL
 *
 * Why a separate file: this client-only logic was muddying both map-preview
 * and map-route. Centralising it keeps the maps URL strategy in one place
 * and lets either component reuse it.
 */
export function OpenInMapsLink({ origin, dest, waypoints }: OpenInMapsLinkProps) {
  const t = useTranslations('map');
  const tPwa = useTranslations('pwa');

  /* Start with a safe SSR-friendly web URL so the server-rendered link works
   * even if JS hasn't hydrated yet. Mount swaps to a deep link if applicable. */
  const [link, setLink] = useState<MapsLink>(() =>
    buildMapsLink({ origin, dest, waypoints, ua: '' }),
  );

  useEffect(() => {
    setLink(
      buildMapsLink({
        origin,
        dest,
        waypoints,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    );
  }, [origin, dest, waypoints]);

  /* iOS deep link: arm fallback on click. Android `geo:` and desktop https
   * don't need this — the OS / browser always handles them. */
  const handleClick =
    link.kind === 'ios-app'
      ? () => attachIosFallback(link.webFallback)
      : undefined;

  /* Desktop: keep target="_blank" so it doesn't disrupt the current view.
   * Mobile deep links: target="_blank" is meaningless (OS hands off to the
   * native app) — better to omit it to avoid the browser opening a stray
   * blank tab on devices where the app isn't installed. */
  const opensInNewTab = link.kind === 'web';
  const ariaLabel = (() => {
    if (link.kind === 'ios-app' || link.kind === 'android-intent') {
      return `${t('openFullscreen')} — ${tPwa('opensInMapsApp')}`;
    }
    return `${t('openFullscreen')} — ${t('opensInNewTab')}`;
  })();

  return (
    <a
      href={link.url}
      target={opensInNewTab ? '_blank' : undefined}
      rel={opensInNewTab ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
    >
      {t('openFullscreen')}
      {opensInNewTab ? <ExternalLink className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
    </a>
  );
}
