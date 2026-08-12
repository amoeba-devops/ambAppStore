/**
 * Build the URL that opens a partner app from the catalog.
 *
 * ## Why a token has to ride along at all
 *
 * v1 apps (car-manager, hscode, sales-report, stock) are SPAs served from this
 * same origin, so they read `localStorage.ama_token` themselves — a bare
 * `/<slug>` link is enough. The v2 apps (car-manager-v2, sales-report-v2) are
 * Next.js and authenticate in **server middleware**, which cannot see
 * localStorage. That middleware expects the AMA JWT as `?ama_token=`, verifies
 * it, writes an HttpOnly session cookie and redirects to the clean URL.
 *
 * ## Why NOT the token in localStorage
 *
 * There are two different AMA tokens in play, and only one of them works:
 *
 *   1. platform session token — what `localStorage.ama_token` holds (admin
 *      login flow). Shape: `{ sub, email, ent_id, ent_code, name, role,
 *      roles[], level }`. Snake_case entity claim, and **no `appCode`**.
 *   2. app-scoped token — what AMA appends when it opens the catalog at
 *      `/apps/:slug?ama_token=…`. Shape: `{ sub, email, entityId, role,
 *      appId, appCode, scope: 'custom_app:context' }`.
 *
 * The v2 apps validate with a Zod schema that requires `entityId` **and** an
 * `appCode` matching their own slug (see packages/shared/src/auth/jwt-claims.ts).
 * Forwarding token #1 therefore fails verification and the app answers
 * `401 Invalid token` — which is exactly what happened when this helper first
 * used the store token (FIX-260812).
 *
 * So: forward token #2, and only when its `appCode` actually matches the app
 * being launched. If we have no matching token, send none — landing on the
 * app's own `/login` (where the user can sign in) beats a hard 401.
 *
 * NOT forwarded: `locale`. The v2 apps resolve language from the `NEXT_LOCALE`
 * cookie (apps/web/src/i18n/request.ts), not from a query param.
 */

/* Captured at module load — earliest possible moment. The router strips query
 * params during hydration (see EntityContextInitializer in App.tsx), so reading
 * `window.location.search` later would come back empty. */
const initialSearch = typeof window === 'undefined' ? '' : window.location.search;

interface AmaTokenClaims {
  appCode?: string;
  exp?: number;
}

function decodeClaims(token: string): AmaTokenClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as AmaTokenClaims;
  } catch {
    return null;
  }
}

/**
 * The AMA app-scoped token from the initial URL, but only if it is still valid
 * and was minted for `slug`.
 *
 * AMA's `appCode` carries the catalog slug without the `app-` prefix
 * (`car-manager-v2` for slug `app-car-manager-v2`); the v2 schema accepts either
 * form, so both are treated as a match.
 */
function appScopedTokenFor(slug: string): string | null {
  const token = new URLSearchParams(initialSearch).get('ama_token');
  if (!token) return null;

  const claims = decodeClaims(token);
  if (!claims?.appCode) return null;

  if (claims.exp && claims.exp * 1000 <= Date.now()) return null;

  const withoutPrefix = slug.replace(/^app-/, '');
  if (claims.appCode !== slug && claims.appCode !== withoutPrefix) return null;

  return token;
}

export function buildAppLaunchUrl(slug: string): string {
  const path = `/${slug}`;
  const token = appScopedTokenFor(slug);
  return token ? `${path}?ama_token=${encodeURIComponent(token)}` : path;
}
