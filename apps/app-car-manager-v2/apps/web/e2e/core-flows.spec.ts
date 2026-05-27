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
    /* Empty state (no candidates) hoặc form. Verify ít nhất 1 trong 2 visible. */
    const emptyStateCta = page.getByRole('link', { name: /Tạo user mới|→.*user|new user/i });
    const candidateSelect = page.locator('[role="combobox"]').first();

    const hasEmpty = await emptyStateCta.isVisible().catch(() => false);
    const hasSelect = await candidateSelect.isVisible().catch(() => false);
    expect(
      hasEmpty || hasSelect,
      'Drivers new page phải có hoặc empty state hoặc user select',
    ).toBe(true);
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

  test('F5 — Manager /audit redirect / forbidden', async ({ page }) => {
    const res = await page.request.get('/audit', { maxRedirects: 0 });
    /* Acceptable: 307 redirect, hoặc 200 với error boundary */
    expect([200, 307, 403, 500].includes(res.status())).toBe(true);
    if (res.status() === 200) {
      /* Verify error page content (requireRole throw) */
      await page.goto('/audit', { waitUntil: 'domcontentloaded' });
      const errorVisible = await page
        .locator('text=/Forbidden|không có quyền|requires ADMIN|CAR-E0102/i')
        .first()
        .isVisible()
        .catch(() => false);
      expect(errorVisible, 'Manager /audit phải hiển thị error').toBe(true);
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
