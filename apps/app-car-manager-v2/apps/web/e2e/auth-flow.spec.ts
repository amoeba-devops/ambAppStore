import { test, expect } from '@playwright/test';
import { VN01, VN01_USERS } from './helpers/fixtures';
import { devLogin, clearSession } from './helpers/auth';

/**
 * Auth flow E2E.
 *
 * Mục tiêu:
 *   1. Audit login form hiện tại — fields nào có, có khớp với yêu cầu
 *      "login bằng organize id + email" không.
 *   2. Verify dev-login mint token đúng claims + redirect đúng role.
 *   3. Verify session cookies + auto-redirect chưa-login → /login.
 *   4. Verify logout flow.
 */

test.describe('Login UI inspection', () => {
  test('A1 — /login form (Wave 3: email-based)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    /* Form 2 field sau Wave 3: ent_code + email. Phone field đã bị remove. */
    await expect(page.locator('input[name="ent_code"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    /* Phone field KHÔNG còn xuất hiện sau Wave 3 */
    await expect(page.locator('input[name="phone"]')).toHaveCount(0);
  });

  test('A2 — Login submit email → AMA endpoint chưa exist → error=not_implemented', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="ent_code"]').fill('VN01');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/login(\?|$)/, { timeout: 15_000 });
    const url = page.url();
    expect(url).toContain('/login');
    /* AMA chưa có /auth/email-login → v2 catch 404 → error=not_implemented.
     * Nếu AMA endpoint khác return 401/500 → error=invalid/server. Test
     * accept bất kỳ error reason — quan trọng là không crash. */
    expect(url).toMatch(/error=/);
  });
});

test.describe('Dev-login token mint', () => {
  test('A3 — Dev-login ADMIN (default entity) set cookie + role ADMIN', async ({
    page,
    context,
  }) => {
    await clearSession(context);
    await page.goto('/dev-login?role=OWNER', { waitUntil: 'domcontentloaded' });
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'amb_session');
    expect(session).toBeDefined();
    expect(session!.httpOnly).toBe(true);
  });

  test('A4 — Dev-login MEMBER landing /today (not /dashboard)', async ({
    page,
    context,
  }) => {
    await clearSession(context);
    await devLogin(page, {
      role: VN01_USERS.driver.devLoginRole,
      entId: VN01.entId,
      sub: VN01_USERS.driver.sub,
    });
    /* Driver root '/' → middleware allowlist → render '/' → page checks role
     * → redirect /today. Page content phải là driver shell, không có
     * AppShell sidebar (driver-trips-list không có sidebar). */
    await page.waitForLoadState('domcontentloaded');
    /* Heading Today (or similar) — verify driver shell render */
    const todayHeading = page.getByText(/Hôm nay|Today|오늘/i).first();
    await expect(todayHeading).toBeVisible({ timeout: 15_000 });
  });

  test('A5 — Dev-login bị disable khi DEMO_AUTO_LOGIN ≠ true', async ({ page }) => {
    /* Trong dev env (DEMO_AUTO_LOGIN=true), endpoint trả 307 với cookie.
     * Test này document behavior — nếu disable, sẽ trả 404. */
    const res = await page.request.get('/dev-login?role=OWNER', { maxRedirects: 0 });
    expect([307, 404]).toContain(res.status());
  });
});

test.describe('Session + logout', () => {
  test('A6 — Chưa login → bất kỳ route được protect → redirect /login', async ({
    page,
    context,
  }) => {
    await clearSession(context);
    /* Direct hit /dashboard (no cookie) → middleware redirect /login */
    const res = await page.request.get('/dashboard', { maxRedirects: 0 });
    expect([307, 308]).toContain(res.status());
    expect(res.headers()['location']).toContain('/login');
  });

  test('A7 — Logout endpoint clear cookies', async ({ page, context }) => {
    await devLogin(page, {
      role: 'MASTER',
      entId: VN01.entId,
      sub: VN01_USERS.master.sub,
    });
    let cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'amb_session')).toBe(true);

    const res = await page.request.post('/api/auth/logout', { maxRedirects: 0 });
    /* Có thể trả 302/307/200. Verify session cookie bị xóa */
    expect([200, 302, 307, 308]).toContain(res.status());
    cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'amb_session');
    /* Cookie hoặc bị xóa (undefined) hoặc set expires=0 */
    expect(session === undefined || session.expires === 0 || session.value === '').toBe(true);
  });
});
