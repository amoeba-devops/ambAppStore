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
 * The v2 apps validate with a Zod schema that requires `entityId` **and** an
 * `appCode` matching their own slug (see packages/shared/src/auth/jwt-claims.ts).
 * The platform session token has neither claim, so forwarding it fails
 * verification and the app answers `401 Invalid token` — which is exactly what
 * happened when this helper first used the store token (FIX-260812). See
 * lib/ama-token.ts for the two token shapes.
 *
 * So: forward the app-scoped token, and only when its `appCode` actually
 * matches the app being launched. If we have no matching token, send none —
 * landing on the app's own `/login` (where the user can sign in) beats a hard
 * 401.
 *
 * NOT forwarded: `locale`. The v2 apps resolve language from the `NEXT_LOCALE`
 * cookie (apps/web/src/i18n/request.ts), not from a query param.
 */

import { appScopedTokenFor } from '@/lib/ama-token';

export function buildAppLaunchUrl(slug: string): string {
  const path = `/${slug}`;
  const token = appScopedTokenFor(slug);
  return token ? `${path}?ama_token=${encodeURIComponent(token)}` : path;
}
