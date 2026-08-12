/**
 * Build the URL that opens a partner app from the catalog.
 *
 * Why the token has to ride along in the query string:
 *   - v1 apps (car-manager, hscode, sales-report, stock) are SPAs served from
 *     this same origin, so they just read `localStorage.ama_token` themselves.
 *   - the v2 apps (car-manager-v2, sales-report-v2) are Next.js and authenticate
 *     on the SERVER — their middleware has no access to localStorage. It expects
 *     the AMA JWT as `?ama_token=`, verifies it, writes an HttpOnly session
 *     cookie and immediately redirects to the clean URL.
 *
 * Launching a v2 app without the param means its middleware sees no token and no
 * cookie, so it bounces straight to the app's own /login page — which is exactly
 * how auto-login was broken (FIX-260812).
 *
 * Adding the param for v1 apps is harmless: they ignore unknown query params.
 *
 * NOT forwarded: `locale`. The v2 apps resolve language from the `NEXT_LOCALE`
 * cookie (see apps/web/src/i18n/request.ts), not from a query param, so passing
 * one would be dead weight.
 */
export function buildAppLaunchUrl(slug: string, token: string | null): string {
  const path = `/${slug}`;
  return token ? `${path}?ama_token=${encodeURIComponent(token)}` : path;
}
