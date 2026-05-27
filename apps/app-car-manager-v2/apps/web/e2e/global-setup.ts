import type { FullConfig } from '@playwright/test';

/**
 * Warm-up Next.js dev server compile cache trước khi chạy E2E tests.
 *
 * Lý do: Next.js dev mode compile on-demand per route. Lần đầu request route
 * nặng (vehicles/new, users/new, reports, audit, costs) có thể tốn 30-90s →
 * test 120s timeout cũng vẫn flake nếu tất cả route hit lần đầu.
 *
 * Warm-up gọi mỗi route 1 lần với cookie hợp lệ, ignore body, chỉ chờ status.
 * Sau đó suite chính chạy với compile cache nóng → consistent timing.
 *
 * TIME BUDGET: ~3-5 phút cho warm-up. Acceptable vì tổng E2E khoảng 30 phút.
 *
 * CI build production (next build && next start) thì skip warm-up vì
 * pre-compiled.
 */

const ROUTES_TO_WARM = [
  '/login',
  '/onboarding',
  '/dashboard',
  '/today',
  '/trips',
  '/trips/new',
  '/drivers',
  '/drivers/new',
  '/vehicles',
  '/vehicles/new',
  '/users',
  '/users/new',
  '/expenses',
  '/expenses/new',
  '/costs',
  '/reports',
  '/audit',
  '/settings',
  '/settings/me',
  '/inbox',
];

async function globalSetup(_config: FullConfig): Promise<void> {
  /* Skip warm-up nếu env var set (vd CI production build). */
  if (process.env.E2E_SKIP_WARMUP === 'true') {
    console.log('[e2e-setup] WARMUP_SKIP=true → bỏ qua warm-up');
    return;
  }

  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

  /* Mint dev-login session cookie để các route protected respond đầy đủ
   * (không bị middleware redirect /login → compile /login chứ không phải target).
   * Dùng default entity (không cần ent_id override). */
  const loginRes = await fetch(`${baseUrl}/dev-login?role=OWNER`, {
    redirect: 'manual',
  });
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    console.warn('[e2e-setup] dev-login KHÔNG trả cookie — skip warm-up');
    return;
  }
  /* Extract amb_session value */
  const sessionMatch = setCookie.match(/amb_session=([^;]+)/);
  if (!sessionMatch) {
    console.warn('[e2e-setup] cookie format unexpected — skip warm-up');
    return;
  }
  const cookieHeader = `amb_session=${sessionMatch[1]}`;

  console.log(`[e2e-setup] Warming up ${ROUTES_TO_WARM.length} routes...`);
  const start = Date.now();
  let ok = 0;
  let fail = 0;

  /* Sequential — concurrent requests trigger Next.js parallel compile, gây
   * RAM spike + slower overall. Serial khoảng 5s/route × 20 = 100s acceptable. */
  for (const path of ROUTES_TO_WARM) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: cookieHeader },
        redirect: 'manual',
        signal: AbortSignal.timeout(60_000),
      });
      /* 200, 307 (redirect onboarding/today), 500 (driver-side error page rendered)
       * đều OK — compile xong. */
      if (res.status < 600) ok++;
    } catch {
      fail++;
    }
  }

  const durationS = Math.round((Date.now() - start) / 1000);
  console.log(
    `[e2e-setup] Warm-up xong — ${ok} ok, ${fail} timeout, ${durationS}s tổng.`,
  );
}

export default globalSetup;
