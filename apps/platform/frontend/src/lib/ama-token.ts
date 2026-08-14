/**
 * The AMA app-scoped token that rides on the catalog entry URL.
 *
 * ## Where it comes from
 *
 * AMA opens a custom app by sending the user to
 * `https://apps.amoeba.site/apps/:slug?ama_token=<jwt>&locale=<xx>` — the
 * catalog detail page, not the app itself. That JWT is the ONLY thing AMA
 * hands over: no `ent_id` / `ent_code` / `ent_name` query params (the older
 * iframe contract that `EntityContextInitializer` was written against).
 *
 * ## Two different AMA tokens exist — this module is about the second one
 *
 *   1. platform session token — what `localStorage.ama_token` holds (admin
 *      login flow). Shape: `{ sub, email, ent_id, ent_code, name, role,
 *      roles[], level }`. Snake_case entity claim, and **no `appCode`**.
 *   2. app-scoped token — what AMA appends when it opens `/apps/:slug`.
 *      Shape: `{ sub, email, entityId, role, appId, appCode,
 *      scope: 'custom_app:context' }`.
 *
 * Everything here reads #2, straight off the initial URL.
 *
 * ## Unverified by design
 *
 * These claims are decoded, never verified — the catalog has no access to
 * `JWT_SECRET`. They are used only to pick which entity's subscriptions to
 * read (a public, read-only endpoint) and which UI branch to render. The
 * token is verified for real by the v2 app's middleware once it is forwarded
 * on the launch link.
 */

/* Captured at module load — earliest possible moment. The router strips query
 * params during hydration (see EntityContextInitializer in App.tsx), so reading
 * `window.location.search` later would come back empty. */
const initialSearch = typeof window === 'undefined' ? '' : window.location.search;

export interface AmaTokenClaims {
  sub?: string;
  email?: string;
  role?: string;
  entityId?: string;
  appId?: string;
  appCode?: string;
  scope?: string;
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

/** The raw token from the initial URL, or `null` if there wasn't one. */
export function getInitialAmaToken(): string | null {
  return new URLSearchParams(initialSearch).get('ama_token');
}

/**
 * Claims of the initial token, as long as it hasn't expired.
 *
 * No `appCode` check here — the caller may be interested in the entity alone
 * (`/apps/:slug` needs it to look up subscriptions regardless of which app the
 * token was minted for). Use `appScopedTokenFor()` when the app identity
 * matters.
 */
export function getInitialAmaClaims(): AmaTokenClaims | null {
  const token = getInitialAmaToken();
  if (!token) return null;

  const claims = decodeClaims(token);
  if (!claims) return null;
  if (claims.exp && claims.exp * 1000 <= Date.now()) return null;

  return claims;
}

/**
 * The initial token, but only if it is still valid and was minted for `slug`.
 *
 * AMA's `appCode` carries the catalog slug without the `app-` prefix
 * (`car-manager-v2` for slug `app-car-manager-v2`); the v2 schema accepts either
 * form, so both are treated as a match.
 */
export function appScopedTokenFor(slug: string): string | null {
  const token = getInitialAmaToken();
  if (!token) return null;

  const claims = getInitialAmaClaims();
  if (!claims?.appCode) return null;

  const withoutPrefix = slug.replace(/^app-/, '');
  if (claims.appCode !== slug && claims.appCode !== withoutPrefix) return null;

  return token;
}
