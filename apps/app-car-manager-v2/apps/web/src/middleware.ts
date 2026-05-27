import { NextResponse, type NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
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
  /* D-010 rev: phone-login page + API. Both public — driver/manager nhập
   * ent_code + phone tại /login → POST /api/auth/login proxy tới AMA.
   * D-011: silent refresh endpoint must be public (middleware triggers it
   * when JWT expired). D-013: logout clears cookies. */
  '/login',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  /* Dev-only endpoints: gated bởi DEMO_AUTO_LOGIN=true inside route handler.
   * Trong production server các route này tự return 404. */
  '/api/dev/',
  '/_next',
  '/favicon.ico',
  /* Static user-guide site lives under apps/web/public/docs/ — must be reachable
   * without a session so prospective / unauthenticated users can read the docs. */
  '/docs/',
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
 * Notably `/` is NOT in this list: Module 3 removal turned the root into a
 * role-aware redirect (driver → `/today`, staff → `/trips`). Drivers hit
 * `/` only as a splash before the page-level redirect fires. We keep the
 * middleware-level deflect to `/today` so drivers don't even render the
 * redirect page.
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

/* Cache tenant-synced state trong-module-instance lifetime (Edge worker
 * instance). Reset khi worker restart. revalidateTag không reach được Edge
 * runtime — chấp nhận stale tối đa 60s. Sync action cũng set syncedAt → DB
 * → next middleware request đọc fresh sau cache TTL. */
const SYNC_CACHE_TTL_MS = 60_000;
const syncCache = new Map<string, { syncedAt: number; cachedAt: number }>();

async function isTenantSynced(entId: string): Promise<boolean> {
  /* Dev mode bypass cache để E2E test sau reset DB thấy state mới ngay.
   * Production: 60s cache trade-off OK vì sync state rarely changes. */
  const useCache = process.env.NODE_ENV === 'production';
  const cached = useCache ? syncCache.get(entId) : null;
  const now = Date.now();
  if (cached && now - cached.cachedAt < SYNC_CACHE_TTL_MS) {
    return cached.syncedAt > 0;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    /* Không có DB connection → fail-open (cho qua, layout sẽ catch). */
    return true;
  }

  try {
    const sql = neon(url);
    const rows = (await sql`
      SELECT tns_users_synced_at AS synced_at
      FROM car_tenant_settings
      WHERE ent_id = ${entId}
      LIMIT 1
    `) as Array<{ synced_at: string | null }>;
    const syncedAt = rows[0]?.synced_at
      ? new Date(rows[0].synced_at).getTime()
      : 0;
    if (useCache) syncCache.set(entId, { syncedAt, cachedAt: now });
    return syncedAt > 0;
  } catch (e) {
    /* DB unreachable → fail-open. Onboarding redirect không phải critical
     * security check, app vẫn function. */
    console.warn('[middleware] isTenantSynced DB error', e);
    return true;
  }
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
    let tokenClaims;
    try {
      tokenClaims = await verifyAmaJwt(incomingToken);
    } catch {
      return new NextResponse('Invalid token', { status: 401 });
    }
    // `req.nextUrl.clone()` preserves basePath; building from `pathname` alone
    // would strip it and bounce the user to the platform catalog instead of
    // back to the app dashboard.
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete('ama_token');
    const res = NextResponse.redirect(cleanUrl);
    /* Persist for the full JWT lifetime. Without `maxAge` Next.js writes a
     * SESSION cookie that iOS Safari wipes the moment the user swipes the
     * PWA away from the app switcher — every relaunch then hits the
     * "no cookie → /session-expired → Safari" path and breaks the
     * standalone experience. We anchor on the JWT's own `exp` so the
     * cookie can never outlive the token jose would refuse to verify. */
    const nowSec = Math.floor(Date.now() / 1000);
    const maxAgeSec = Math.max(60, tokenClaims.exp - nowSec);
    res.cookies.set(SESSION_COOKIE, incomingToken, { ...cookieAttrs, maxAge: maxAgeSec });
    return res;
  }

  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieToken) {
    // D-012: redirect /login (mobile-friendly phone-login) thay vì /session-expired
    return NextResponse.redirect(absoluteUrl(req, '/login'));
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

    /* Onboarding gate (REQ-20260526 §3.6):
     *   - ADMIN/MANAGER chưa onboard (tns_users_synced_at IS NULL) → redirect /onboarding
     *   - DRIVER không bị gate (ensureCarUser tự tạo row cho riêng họ)
     *   - Bỏ qua /onboarding, /api/* để tránh redirect loop
     *
     * Previously gate ở (app)/layout.tsx nhưng Next.js streaming RSC render
     * destination inline thay vì HTTP 307 → URL bar không update. Move xuống
     * middleware cho hard 307 deterministic.
     *
     * Edge runtime + Neon HTTP driver: query lightweight, không cần cache (~50ms).
     * Tradeoff: 1 DB call mỗi protected request. Add cache layer khi cần. */
    if (
      localRole !== 'DRIVER' &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/dev-login')
    ) {
      const synced = await isTenantSynced(claims.ent_id);
      if (!synced) {
        return NextResponse.redirect(absoluteUrl(req, '/onboarding'));
      }
    }
    // MUST propagate as REQUEST headers (not response headers) so RSC's
    // `headers()` in getCurrentUser() can read x-ent-id / x-user-id / x-user-role.
    // Setting on `res.headers` would only send them to the browser, not the page.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-ent-id', claims.ent_id);
    requestHeaders.set('x-user-id', claims.sub);
    requestHeaders.set('x-user-role', claims.role);
    /* AMA-issued entity name — optional, only present once AMA includes the
     * `entityName` claim. RSCs use it as a fallback for the sidebar header
     * when the tenant hasn't customized `tns_tenant_name` yet. */
    if (claims.ent_name) {
      requestHeaders.set('x-ent-name', claims.ent_name);
    }
    // D-006 (Step 4): forward optional info for ensureCarUser upsert in RSC layout
    if (claims.email) requestHeaders.set('x-user-email', claims.email);
    if (claims.name) requestHeaders.set('x-user-name', encodeURIComponent(claims.name));
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    // D-011 Silent refresh: cookie present but JWT verify failed (expired).
    // Try refresh path if amb_ama_refresh cookie exists; refresh route will
    // mint new app token + update cookies, OR fail-and-redirect /login itself.
    // For OTHER errors (invalid signature, malformed) → straight /login.
    const hasRefresh = req.cookies.get('amb_ama_refresh');
    const errName = err instanceof Error ? err.name : '';
    const isExpired = errName === 'JWTExpired' || /expired/i.test(String(err));

    if (hasRefresh && isExpired) {
      const url = new URL('/api/auth/refresh', req.url);
      url.searchParams.set('next', pathname + (req.nextUrl.search ?? ''));
      return NextResponse.redirect(url);
    }

    // Invalid signature / malformed cookie → clear + /login.
    const res = NextResponse.redirect(absoluteUrl(req, '/login'));
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete('amb_ama_access');
    res.cookies.delete('amb_ama_refresh');
    return res;
  }
}

export const config = {
  // Match every path INCLUDING root '/' — the pattern needs both an explicit
  // '/' entry AND the negative-lookahead variant; using only the latter skips
  // the root request (which is where the dashboard lives under basePath).
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)'],
};
