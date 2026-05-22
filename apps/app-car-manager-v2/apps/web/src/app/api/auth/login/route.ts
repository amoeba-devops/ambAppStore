import { NextResponse, type NextRequest } from 'next/server';
import { absoluteUrl } from '@/lib/request-origin';

/**
 * D-010 rev — Phone-login proxy endpoint cho v2.
 *
 * Flow:
 *   1. v2 nhận form { ent_code, phone, remember } từ /login page
 *   2. POST tới AMA /auth/phone-login → AMA verify + mint AMA access/refresh tokens
 *   3. Với accessToken, GET AMA /entity-settings/custom-apps/my → tìm eca_id của
 *      'app-car-manager-v2' (entity đã install qua seed)
 *   4. POST AMA /entity-settings/custom-apps/:eca_id/token → mint app token 1h
 *      (role = eur_role — D-002)
 *   5. Set cookie amb_session với app token; maxAge 30d nếu remember, 8h nếu không
 *   6. Redirect tới /today (driver) hoặc / (admin/manager) — auto-decide by role
 *
 * Error → redirect /login?error=<reason>
 */

const APP_CODE = 'app-car-manager-v2';
const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

export const dynamic = 'force-dynamic';

/* Chuẩn hoá SĐT VN về 10 chữ số bắt đầu với `0`. Xử lý các format user hay nhập:
 *   +84 90 4567890   → 0904567890
 *   84-90-4567890    → 0904567890
 *   0090 4567890     → 0904567890  (international 00 prefix)
 *   0904 567 890     → 0904567890
 *   0904567890       → 0904567890  (no-op)
 * Phone DB lưu canonical 10 chữ số "0XXXXXXXXX" — phải khớp exact ở phone-login. */
function normalizePhoneVn(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  // "00" international prefix → strip (cả "0084..." form)
  if (digits.startsWith('00')) digits = digits.slice(2);
  // "84..." (11 digits) → "0..." (10 digits). VN mobile gốc luôn 10 ký tự.
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const entityCode = (form.get('ent_code') as string | null)?.trim().toUpperCase();
  const phoneRaw = form.get('phone') as string | null;
  const phone = phoneRaw ? normalizePhoneVn(phoneRaw) : undefined;
  const remember = form.get('remember') === 'on';
  const nextParam = form.get('next') as string | null;

  if (!entityCode || !phone) {
    return NextResponse.redirect(absoluteUrl(req, '/login?error=missing'));
  }

  /* Diagnostic logging — mask phone (4 digits prefix + 2 suffix) để dev biết
   * input đến server thế nào (đã normalize đúng chưa). */
  const masked = phone.length >= 6
    ? `${phone.slice(0, 4)}****${phone.slice(-2)} (len=${phone.length})`
    : `len=${phone.length}`;
  console.log(`[login] attempt ent=${entityCode} phone=${masked} rawLen=${phoneRaw?.length ?? 0}`);

  try {
    // 1) AMA phone-login
    const loginRes = await fetch(`${AMA_API}/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_code: entityCode, phone }),
    });

    if (loginRes.status === 429) {
      console.warn(`[login] rate_limit ent=${entityCode} phone=${masked}`);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=rate_limit'));
    }
    if (!loginRes.ok) {
      const errBody = await loginRes.text().catch(() => '');
      console.warn(`[login] AMA phone-login fail status=${loginRes.status} ent=${entityCode} phone=${masked} body=${errBody.slice(0, 200)}`);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=invalid'));
    }

    const loginData = await loginRes.json();
    // AMA wraps response: { success, data: { tokens: { accessToken, refreshToken } } }
    // Also handle legacy shapes: { tokens: ... } or { accessToken: ... } directly.
    const tokens = loginData?.data?.tokens ?? loginData?.tokens ?? loginData;
    const accessToken: string | undefined = tokens?.accessToken;
    if (!accessToken) {
      console.error('[login] AMA response missing accessToken', loginData);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=server'));
    }

    // 2) Find eca_id of app-car-manager-v2 (filtered by user's entity + role)
    const myAppsRes = await fetch(`${AMA_API}/entity-settings/custom-apps/my`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!myAppsRes.ok) {
      console.error('[login] custom-apps/my fail', myAppsRes.status);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=not_installed'));
    }

    const myAppsBody = await myAppsRes.json();
    // Response shape: { data: [...] } or [...] — handle both
    const apps: Array<{ id?: string; ecaId?: string; code?: string; ecaCode?: string }> =
      Array.isArray(myAppsBody) ? myAppsBody : (myAppsBody?.data ?? []);
    const app = apps.find((a) => (a.code ?? a.ecaCode) === APP_CODE);
    if (!app) {
      return NextResponse.redirect(absoluteUrl(req, '/login?error=not_installed'));
    }
    const ecaId = app.id ?? app.ecaId;
    if (!ecaId) {
      console.error('[login] eca_id missing', app);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=server'));
    }

    // 3) Mint app token (1h, role=eur_role per D-002)
    const tokenRes = await fetch(
      `${AMA_API}/entity-settings/custom-apps/${ecaId}/token`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      console.error('[login] mint app token fail', tokenRes.status, errBody);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=invalid'));
    }
    const tokenBody = await tokenRes.json();
    // AMA wraps: { success, data: { token, expiresAt } }
    const token: string | undefined = tokenBody?.data?.token ?? tokenBody?.token;
    if (!token) {
      console.error('[login] mint app token: no token in response', tokenBody);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=server'));
    }

    // 4) Set cookies + redirect
    const IS_PROD = process.env.NODE_ENV === 'production';
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'amb_session';
    const maxAge = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
    const cookieAttrs = {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: (IS_PROD ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };

    const redirectTo = nextParam && nextParam.startsWith('/') ? nextParam : '/';

    const refreshToken: string | undefined = tokens?.refreshToken;

    const res = NextResponse.redirect(absoluteUrl(req, redirectTo));
    // Primary session cookie — app token (1h JWT, but cookie keeps maxAge for browser persistence)
    res.cookies.set(cookieName, token, { ...cookieAttrs, maxAge });
    // AMA access token — for admin server actions calling back AMA endpoints
    // (e.g. POST /entity-settings/members/phone-add). 4h expiry matches AMA default.
    res.cookies.set('amb_ama_access', accessToken, { ...cookieAttrs, maxAge: 4 * 60 * 60 });
    // AMA refresh token — for silent refresh when app token (1h) expires.
    // 7d expiry matches AMA default. Rotates on each refresh.
    if (refreshToken) {
      res.cookies.set('amb_ama_refresh', refreshToken, {
        ...cookieAttrs,
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return res;
  } catch (e) {
    console.error('[login] unexpected error', e);
    return NextResponse.redirect(absoluteUrl(req, '/login?error=server'));
  }
}
