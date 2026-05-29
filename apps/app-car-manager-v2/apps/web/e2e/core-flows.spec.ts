import { test, expect } from '@playwright/test';
import { VN01, VN01_USERS } from './helpers/fixtures';
import { devLogin, clearSession } from './helpers/auth';

/**
 * Core happy-path flows — verify key user journeys render thành công.
 *
 * Scope: smoke navigation, không exercise full CRUD (full CRUD tốn time +
 * cần DB seeded). Mục tiêu: detect catastrophic broken pages.
 *
 * Sample flow per role:
 *   - ADMIN: dashboard → drivers → vehicles → users → reports → audit
 *   - MANAGER: dashboard → trips → drivers → vehicles → reports
 *   - DRIVER: today → trips → expenses → settings/me
 */

test.describe('Flow — ADMIN', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearSession(context);
    await devLogin(page, {
      role: 'MASTER',
      entId: VN01.entId,
      sub: VN01_USERS.master.sub,
    });
  });

  test('F1 — Admin lướt qua các trang chính không crash', async ({ page }) => {
    const pages = [
      '/dashboard',
      '/drivers',
      '/vehicles',
      '/trips',
      '/users',
      '/expenses',
      '/costs',
      '/reports',
      '/audit',
      '/inbox',
      '/settings/me',
    ];

    for (const path of pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      /* No "Application error" overlay từ Next.js error.tsx */
      const errorOverlay = page.locator('text=/Application error|Internal Server Error|500/i');
      const errorCount = await errorOverlay.count();
      expect(errorCount, `Error on ${path}`).toBe(0);
    }
  });

  test('F2 — Admin /drivers/new shows form fields', async ({ page }) => {
    await page.goto('/drivers/new', { waitUntil: 'domcontentloaded' });
    /* The page renders one of two arms:
     *   - form: the visible Radix Select trigger (a <button role="combobox">).
     *     Radix ALSO renders a hidden native <select> that shares role
     *     "combobox", so a bare [role=combobox].first() can resolve to the
     *     hidden one — target the <button> specifically.
     *   - empty state: an "invite on AMA" CTA (no un-linked car_users yet).
     * toBeVisible auto-retries, absorbing the hydration timing that made the
     * old snapshot-style .isVisible() flaky. */
    const candidateSelect = page.locator('button[role="combobox"]').first();
    const emptyStateCta = page.getByRole('link', { name: /Mời user trên AMA|invite.*AMA/i });
    await expect(candidateSelect.or(emptyStateCta).first()).toBeVisible({ timeout: 15_000 });
  });

  test('F3 — Admin /vehicles/new form render', async ({ page }) => {
    await page.goto('/vehicles/new', { waitUntil: 'domcontentloaded' });
    /* Form should have inputs */
    const inputs = await page.locator('input').count();
    expect(inputs, 'Vehicle form phải có inputs').toBeGreaterThan(2);
  });
});

test.describe('Flow — MANAGER', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearSession(context);
    await devLogin(page, {
      role: 'MANAGER',
      entId: VN01.entId,
      sub: VN01_USERS.manager.sub,
    });
  });

  test('F4 — Manager lướt các trang được phép', async ({ page }) => {
    const pages = [
      '/dashboard',
      '/drivers',
      '/vehicles',
      '/trips',
      '/users',
      '/expenses',
      '/costs',
      '/reports',
      '/settings/me',
    ];

    for (const path of pages) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const errorOverlay = page.locator('text=/Application error|Internal Server Error|500/i');
      const errorCount = await errorOverlay.count();
      expect(errorCount, `Error on ${path}`).toBe(0);
    }
  });

  test('F5 — Manager /audit forbidden', async ({ page }) => {
    const res = await page.request.get('/audit', { maxRedirects: 0 });
    /* Audit log is ADMIN-only (requireRole throws CAR-E0102). A manager gets
     * either a redirect away or the global error boundary (200 with a generic
     * error UI — the raw error message/code is intentionally hidden from the
     * client). Either way they must never see the audit content. */
    expect([200, 307, 403, 500].includes(res.status()), `Got ${res.status()}`).toBe(true);
    if (res.status() === 200) {
      await page.goto('/audit', { waitUntil: 'domcontentloaded' });
      /* The audit log table renders only for an authorised admin; the error
       * boundary has no table. Its absence confirms the manager is blocked. */
      const auditTableVisible = await page
        .locator('table')
        .first()
        .isVisible()
        .catch(() => false);
      expect(auditTableVisible, 'Manager must not see audit log content').toBe(false);
    }
  });
});

test.describe('Flow — DRIVER', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearSession(context);
    await devLogin(page, {
      role: 'MEMBER',
      entId: VN01.entId,
      sub: VN01_USERS.driver.sub,
    });
  });

  test('F6 — Driver landing /today render', async ({ page }) => {
    await page.goto('/today', { waitUntil: 'domcontentloaded' });
    /* Driver shell hiển thị card "Hôm nay" hoặc tương tự */
    const todayText = page.getByText(/Hôm nay|Today|오늘|Chuyến đi|Trip|운행/i).first();
    await expect(todayText).toBeVisible({ timeout: 10_000 });
  });

  test('F7 — Driver /trips render (filtered list)', async ({ page }) => {
    await page.goto('/trips', { waitUntil: 'domcontentloaded' });
    /* Page render không crash */
    const errorOverlay = page.locator('text=/Application error|Internal Server Error|500/i');
    expect(await errorOverlay.count()).toBe(0);
  });

  test('F8 — Driver /expenses/new form render', async ({ page }) => {
    await page.goto('/expenses/new', { waitUntil: 'domcontentloaded' });
    const inputs = await page.locator('input, textarea, select, button').count();
    expect(inputs, 'Expense form phải có form controls').toBeGreaterThan(2);
  });

  test('F9 — Driver /settings/me render', async ({ page }) => {
    await page.goto('/settings/me', { waitUntil: 'domcontentloaded' });
    const errorOverlay = page.locator('text=/Application error|Internal Server Error|500/i');
    expect(await errorOverlay.count()).toBe(0);
  });
});
