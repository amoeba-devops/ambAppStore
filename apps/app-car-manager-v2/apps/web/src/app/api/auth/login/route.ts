import { NextResponse, type NextRequest } from 'next/server';
import { absoluteUrl } from '@/lib/request-origin';

/**
 * Email-login proxy endpoint cho v2 (REQ-20260526 Wave 3).
 *
 * Flow:
 *   1. v2 nhận form { ent_code, email, remember } từ /login page
 *   2. POST tới AMA `/auth/email-login` → AMA verify + mint access/refresh tokens
 *   3. Với accessToken, GET AMA `/entity-settings/custom-apps/my` → tìm eca_id
 *      của 'app-car-manager-v2' (entity đã install qua seed)
 *   4. POST AMA `/entity-settings/custom-apps/:eca_id/token` → mint app token 1h
 *   5. Set cookies (amb_session/amb_ama_access/amb_ama_refresh) → redirect
 *
 * Error → redirect /login?error=<reason>
 *
 * AMA Backend Dependency:
 *   `POST /auth/email-login { entity_code, email }` — endpoint mới cần AMA team
 *   build. Chi tiết: docs/integration/AMA-DEPENDENCIES.md §2.4.
 *   Trong khi chờ AMA endpoint, user dev local nên dùng /dev-login để bypass.
 */

const APP_CODE = 'app-car-manager-v2';
const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

export const dynamic = 'force-dynamic';

/* Basic email validation — RFC 5322 simplified. Server validate, KHÔNG trust
 * client-side type="email" alone. */
function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

/* Mask email trong logs: foo@bar.com → fo***@bar.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const entityCode = (form.get('ent_code') as string | null)?.trim().toUpperCase();
  const emailRaw = form.get('email') as string | null;
  const email = emailRaw?.trim().toLowerCase();
  const remember = form.get('remember') === 'on';
  const nextParam = form.get('next') as string | null;

  if (!entityCode || !email || !isValidEmail(email)) {
    return NextResponse.redirect(absoluteUrl(req, '/login?error=missing'));
  }

  const masked = maskEmail(email);
  console.log(`[login] attempt ent=${entityCode} email=${masked}`);

  try {
    // 1) AMA email-login
    const loginRes = await fetch(`${AMA_API}/auth/email-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_code: entityCode, email }),
    });

    if (loginRes.status === 429) {
      console.warn(`[login] rate_limit ent=${entityCode} email=${masked}`);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=rate_limit'));
    }
    if (loginRes.status === 404 || loginRes.status === 501) {
      /* 404 = AMA endpoint chưa tồn tại (Wave 3 pending).
       * 501 = endpoint tồn tại nhưng passwordless bị tắt
       *       (E1099 — AMA env CAR_V2_EMAIL_LOGIN_PASSWORDLESS != 'true').
       * Cả hai → "tính năng chưa khả dụng", KHÔNG để rơi vào nhánh `invalid`
       * (vốn hiện message "sai mã DN/email" gây hiểu lầm — bug đã từng làm
       * mất công debug nhầm credentials). */
      console.error(
        `[login] AMA email-login unavailable status=${loginRes.status} — endpoint missing or passwordless disabled`,
      );
      return NextResponse.redirect(absoluteUrl(req, '/login?error=not_implemented'));
    }
    if (!loginRes.ok) {
      const errBody = await loginRes.text().catch(() => '');
      console.warn(
        `[login] AMA email-login fail status=${loginRes.status} ent=${entityCode} email=${masked} body=${errBody.slice(0, 200)}`,
      );
      return NextResponse.redirect(absoluteUrl(req, '/login?error=invalid'));
    }

    const loginData = await loginRes.json();
    /* AMA wraps response: { success, data: { tokens: { accessToken, refreshToken } } }
     * Also handle legacy shapes: { tokens: ... } or { accessToken: ... } directly. */
    const tokens = loginData?.data?.tokens ?? loginData?.tokens ?? loginData;
    const accessToken: string | undefined = tokens?.accessToken;
    if (!accessToken) {
      console.error('[login] AMA response missing accessToken', loginData);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=server'));
    }

    // 2) Find eca_id of app-car-manager-v2
    const myAppsRes = await fetch(`${AMA_API}/entity-settings/custom-apps/my`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!myAppsRes.ok) {
      console.error('[login] custom-apps/my fail', myAppsRes.status);
      return NextResponse.redirect(absoluteUrl(req, '/login?error=not_installed'));
    }

    const myAppsBody = await myAppsRes.json();
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
    res.cookies.set(cookieName, token, { ...cookieAttrs, maxAge });
    res.cookies.set('amb_ama_access', accessToken, { ...cookieAttrs, maxAge: 4 * 60 * 60 });
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
