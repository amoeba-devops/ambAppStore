import 'server-only';

interface BuildUrlInput {
  pickup: string;
  dropoff: string;
  stopovers?: string[];
}

/**
 * Build a Google Maps "directions" share URL.
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 * Format used:
 *   https://www.google.com/maps/dir/?api=1
 *     &origin=<pickup>
 *     &destination=<dropoff>
 *     &waypoints=<s1>|<s2>|...
 *     &travelmode=driving
 */
export function buildGoogleMapsUrl({ pickup, dropoff, stopovers = [] }: BuildUrlInput): string {
  const params = new URLSearchParams({
    api: '1',
    origin: pickup,
    destination: dropoff,
    travelmode: 'driving',
  });
  if (stopovers.length > 0) {
    /* Google Maps expects waypoints joined by `|` — URLSearchParams will encode
     * the pipe character, which Google's parser still accepts. */
    params.set('waypoints', stopovers.join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
