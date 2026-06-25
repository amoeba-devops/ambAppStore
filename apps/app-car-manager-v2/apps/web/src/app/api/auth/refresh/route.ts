import { NextResponse, type NextRequest } from 'next/server';
import { absoluteUrl } from '@/lib/request-origin';

/**
 * D-011 — Silent refresh endpoint.
 *
 * Flow:
 *   1. Đọc `amb_ama_refresh` cookie
 *   2. POST AMA /auth/refresh → new access + refresh tokens (rotating)
 *   3. POST AMA /custom-apps/:id/token → new app token (1h, role=eur_role)
 *   4. Update 3 cookies (amb_session, amb_ama_access, amb_ama_refresh)
 *   5. Redirect tới `?next=<path>` hoặc /
 *
 * Triggered:
 *   - Middleware: khi verify JWT fail (expired) → redirect /api/auth/refresh?next=<current>
 *   - Optional client polling: future enhancement
 *
 * Fail → redirect /login (clear cookies first).
 */

const APP_CODE = 'app-car-manager-v2';
const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

export const dynamic = 'force-dynamic';

async function doRefresh(req: NextRequest): Promise<NextResponse> {
  const nextParam = req.nextUrl.searchParams.get('next');
  const redirectTo = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  const refreshFail = (): NextResponse => {
    const res = NextResponse.redirect(absoluteUrl(req, '/login'));
    res.cookies.delete(process.env.SESSION_COOKIE_NAME ?? 'amb_session');
    res.cookies.delete('amb_ama_access');
    res.cookies.delete('amb_ama_refresh');
    return res;
  };

  const refreshToken = req.cookies.get('amb_ama_refresh')?.value;
  if (!refreshToken) return refreshFail();

  try {
    // 1) AMA refresh → new access + refresh
    const refreshRes = await fetch(`${AMA_API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!refreshRes.ok) return refreshFail();
    const refreshData = await refreshRes.json();
    // AMA wraps in { success, data: { ... } } (refresh returns tokens at root of data)
    const tokens = refreshData?.data?.tokens ?? refreshData?.data ?? refreshData?.tokens ?? refreshData;
    const newAccess: string | undefined = tokens?.accessToken;
    const newRefresh: string | undefined = tokens?.refreshToken;
    if (!newAccess) return refreshFail();

    // 2) Find eca_id of app-car-manager-v2
    const myAppsRes = await fetch(`${AMA_API}/entity-settings/custom-apps/my`, {
      headers: { Authorization: `Bearer ${newAccess}` },
    });
    if (!myAppsRes.ok) return refreshFail();
    const myAppsBody = await myAppsRes.json();
    const apps: Array<{ id?: string; ecaId?: string; code?: string; ecaCode?: string }> =
      Array.isArray(myAppsBody) ? myAppsBody : (myAppsBody?.data ?? []);
    const app = apps.find((a) => (a.code ?? a.ecaCode) === APP_CODE);
    if (!app) return refreshFail();
    const ecaId = app.id ?? app.ecaId;
    if (!ecaId) return refreshFail();

    // 3) Mint new app token
    const tokenRes = await fetch(
      `${AMA_API}/entity-settings/custom-apps/${ecaId}/token`,
      { method: 'POST', headers: { Authorization: `Bearer ${newAccess}` } },
    );
    if (!tokenRes.ok) return refreshFail();
    const tokenBody = await tokenRes.json();
    const token: string | undefined = tokenBody?.data?.token ?? tokenBody?.token;
    if (!token) return refreshFail();

    // 4) Update cookies (keep existing cookie name + maxAge policy)
    const IS_PROD = process.env.NODE_ENV === 'production';
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
    const cookieAttrs = {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: (IS_PROD ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
    // Refresh extends session — use 30d (driver "remember" default behavior).
    // If user explicitly opted out of remember, they'd hit /login again earlier.
    const sessionMaxAge = 30 * 24 * 60 * 60;

    const res = NextResponse.redirect(absoluteUrl(req, redirectTo));
    res.cookies.set(cookieName, token, { ...cookieAttrs, maxAge: sessionMaxAge });
    res.cookies.set('amb_ama_access', newAccess, {
      ...cookieAttrs,
      maxAge: 4 * 60 * 60,
    });
    if (newRefresh) {
      res.cookies.set('amb_ama_refresh', newRefresh, {
        ...cookieAttrs,
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return res;
  } catch (e) {
    console.error('[refresh] error', e);
    return refreshFail();
  }
}

// Accept GET (browser nav) + POST (programmatic)
export async function GET(req: NextRequest) {
  return doRefresh(req);
}

export async function POST(req: NextRequest) {
  return doRefresh(req);
}
