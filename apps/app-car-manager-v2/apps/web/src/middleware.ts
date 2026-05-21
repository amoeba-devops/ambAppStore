import { NextResponse, type NextRequest } from 'next/server';
import { mapAmaRoleToLocal } from '@car-v2/shared/auth';
import { verifyAmaJwt } from '@/lib/auth/verify-jwt';
import { absoluteUrl } from '@/lib/request-origin';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
const PUBLIC_PATHS = [
  '/api/v1/health',
  /* Cron routes (REQ-20260519) — protected by Bearer CRON_SECRET inside the
   * route handler, NOT JWT. Must bypass session-cookie middleware so Render
   * Cron / CLI scripts can hit them. */
  '/api/v1/cron/',
  '/session-expired',
  '/dev-login',
  '/_next',
  '/favicon.ico',
  /* PWA assets — must be reachable without a session so the browser can
   * install + bootstrap the SW before the user authenticates. */
  '/manifest.webmanifest',
  '/sw.js',
  '/icons',
  '/offline.html',
];
const IS_PROD = process.env.NODE_ENV === 'production';

/* Allowlist of paths a DRIVER role can hit directly. Anything else gets
 * deflected to `/today`.
 *
 * Why allowlist (not blocklist):
 *   - New admin routes added later won't accidentally leak to drivers.
 *   - Easier to audit at review time — the whole set fits in one screen.
 *
 * Notably `/` is NOT in this list: that page renders the Admin/Manager
 * dashboard (KPI cards, fleet status, spend mix) which is irrelevant —
 * and partly leaky — for drivers. The deflect rule then bounces driver `/`
 * to `/today`, which is their actual home.
 *
 * The `/trips/:id/edit` denial is encoded as an explicit early return INSIDE
 * the `/trips/...` branch — otherwise the broad `/trips` prefix would let it
 * through. Same idea for `/trips/new`. */
function isDriverAllowed(pathname: string): boolean {
  if (pathname === '/today') return true;
  if (pathname === '/trips') return true;
  if (pathname.startsWith('/trips/')) {
    if (pathname === '/trips/new') return false;
    if (/^\/trips\/[^/]+\/edit$/.test(pathname)) return false;
    return /^\/trips\/[^/]+$/.test(pathname);
  }
  /* Driver expense history (`/expenses`) + submission (`/expenses/new`). */
  if (pathname === '/expenses' || pathname.startsWith('/expenses/')) return true;
  /* Profile/preferences/logout (NOT the tenant `/settings`). */
  if (pathname === '/settings/me' || pathname.startsWith('/settings/me/')) return true;
  /* In-app notification stream. */
  if (pathname === '/inbox' || pathname.startsWith('/inbox/')) return true;
  /* Server actions + JSON endpoints are mounted under /api — leave them open
   * since the actions themselves do their own role checks. */
  if (pathname.startsWith('/api/')) return true;
  return false;
}

const cookieAttrs = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? ('none' as const) : ('lax' as const),
  path: '/',
};

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const incomingToken = searchParams.get('ama_token');
  if (incomingToken) {
    try {
      await verifyAmaJwt(incomingToken);
    } catch {
      return new NextResponse('Invalid token', { status: 401 });
    }
    // `req.nextUrl.clone()` preserves basePath; building from `pathname` alone
    // would strip it and bounce the user to the platform catalog instead of
    // back to the app dashboard.
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete('ama_token');
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(SESSION_COOKIE, incomingToken, cookieAttrs);
    return res;
  }

  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieToken) {
    return NextResponse.redirect(absoluteUrl(req, '/session-expired'));
  }
  try {
    const claims = await verifyAmaJwt(cookieToken);
    /* Driver route guard — applied AFTER JWT verify so we trust the role
     * claim. Admin / Manager continue with no extra check; the page-level
     * `requireRole()` in each RSC still handles finer permissions for them. */
    const localRole = mapAmaRoleToLocal(claims.role);
    if (localRole === 'DRIVER' && !isDriverAllowed(pathname)) {
      return NextResponse.redirect(absoluteUrl(req, '/today'));
    }
    // MUST propagate as REQUEST headers (not response headers) so RSC's
    // `headers()` in getCurrentUser() can read x-ent-id / x-user-id / x-user-role.
    // Setting on `res.headers` would only send them to the browser, not the page.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-ent-id', claims.ent_id);
    requestHeaders.set('x-user-id', claims.sub);
    requestHeaders.set('x-user-role', claims.role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Cookie present but verification failed — most common cause: cookie minted
    // by a sibling app with different `app_code` (Zod parse fails). On localhost
    // dev, all amb apps share the same cookie name on the same origin, so this
    // is expected. Clear the bad cookie so the next request goes through the
    // clean `no cookie → /session-expired → re-login` flow instead of looping.
    const res = NextResponse.redirect(absoluteUrl(req, '/session-expired'));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // Match every path INCLUDING root '/' — the pattern needs both an explicit
  // '/' entry AND the negative-lookahead variant; using only the latter skips
  // the root request (which is where the dashboard lives under basePath).
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)'],
};
