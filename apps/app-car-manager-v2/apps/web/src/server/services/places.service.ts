import { CarError } from '@car-v2/shared/errors';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:autocomplete';

/* Vietnam bounding box (rough, includes Hoang Sa/Truong Sa for completeness). */
const VN_BBOX = {
  low:  { latitude:  8.18, longitude: 102.14 },
  high: { latitude: 23.39, longitude: 109.46 },
};

export interface PlacePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

interface AutocompleteOptions {
  query: string;
  /** Same token used across keystrokes within one autocomplete "session" — Google
   *  bills 1 session = many requests, much cheaper than per-request. Reset token
   *  after user picks a result. */
  sessionToken?: string;
  /** UI locale — 'vi' (default) / 'en' / 'ko'. */
  languageCode?: string;
}

/**
 * Server-side wrapper for Google Places API (New) — Autocomplete endpoint.
 * Throws CarError on any failure; caller should let it bubble to the route
 * handler which converts to a structured response.
 */
export async function autocompletePlaces(opts: AutocompleteOptions): Promise<PlacePrediction[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new CarError('CAR-E0500', 500, 'GOOGLE_PLACES_API_KEY not configured');
  }

  const res = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      /* Only request the fields we need — keeps response small + reduces cost. */
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: opts.query,
      languageCode: opts.languageCode ?? 'vi',
      regionCode: 'VN',
      sessionToken: opts.sessionToken,
      locationBias: { rectangle: VN_BBOX },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CarError(
      'CAR-E0500',
      502,
      `Places API ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  type Suggestion = {
    placePrediction?: {
      placeId: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  };
  const data: { suggestions?: Suggestion[] } = await res.json();
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => {
      const main = p.structuredFormat?.mainText?.text ?? '';
      const secondary = p.structuredFormat?.secondaryText?.text ?? '';
      return {
        placeId: p.placeId,
        primaryText: main,
        secondaryText: secondary,
        fullText: [main, secondary].filter(Boolean).join(', '),
      };
    });
}
