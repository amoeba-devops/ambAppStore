import type { Location } from '@repo/api-types';

/**
 * Build a Google Maps directions URL from pickup → stopovers → destination.
 * Uses the public URL scheme: https://www.google.com/maps/dir/?api=1&...
 *
 * Place IDs are preferred when available (more accurate); falls back to
 * lat,lng coordinates otherwise.
 */
export function buildMapsUrl(
  pickup: Location,
  destination: Location,
  stopovers: Location[] = [],
): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('travelmode', 'driving');

  url.searchParams.set('origin', `${pickup.lat},${pickup.lng}`);
  if (pickup.placeId) url.searchParams.set('origin_place_id', pickup.placeId);

  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  if (destination.placeId) url.searchParams.set('destination_place_id', destination.placeId);

  if (stopovers.length > 0) {
    const waypoints = stopovers.map((s) => `${s.lat},${s.lng}`).join('|');
    url.searchParams.set('waypoints', waypoints);
    const placeIds = stopovers.map((s) => s.placeId).filter(Boolean);
    if (placeIds.length === stopovers.length) {
      url.searchParams.set('waypoint_place_ids', placeIds.join('|'));
    }
  }

  return url.toString();
}
