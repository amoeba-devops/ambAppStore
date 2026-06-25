import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import {
  captureRaw,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  RAW_OUT,
} from './_helpers.js';

// End-to-end check that the search box on every page can find at least one
// hit for representative Vietnamese terms across roles. Also captures a shot
// of the dropdown open for the landing-quality screenshot in the polish phase.

test.describe('User guide — search functional', () => {
  test.beforeEach(({ }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Desktop search check only');
    test.skip(uiLocaleFromTestInfo(info) !== 'vi', 'VI search only for P5');
  });

  test('typing "đặt xe" surfaces Manager 02 page', async ({ page }) => {
    await page.goto('/docs/user-guide/vi/admin/01-dashboard.html');
    const input = page.locator('#guide-search-input');
    await input.fill('đặt xe');
    // Debounced (80ms) + fetch — give it time
    await page.waitForTimeout(700);
    const results = page.locator('#guide-search-results.is-open');
    await expect(results).toBeVisible();
    await expect(results).toContainText(/Đặt xe|đặt xe|TẠO CHUYẾN/i);

    // Capture for visual proof (also useful for landing polish)
    const out = resolve(RAW_OUT, '..', 'preview', 'search-dropdown-dat-xe.png');
    await captureRaw(page, out, { fullPage: false });
  });

  test('typing "chi phí" surfaces multiple roles', async ({ page }) => {
    await page.goto('/docs/user-guide/vi/common/00-gioi-thieu.html');
    await page.locator('#guide-search-input').fill('chi phí');
    await page.waitForTimeout(700);
    const hits = page.locator('#guide-search-results .search__hit');
    const count = await hits.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('typing nonsense shows empty state', async ({ page }) => {
    await page.goto('/docs/user-guide/vi/driver/00-tong-quan.html');
    await page.locator('#guide-search-input').fill('zzzzzqqqq');
    await page.waitForTimeout(700);
    await expect(page.locator('#guide-search-results')).toContainText(/Không tìm thấy/);
  });

  test('/ keyboard shortcut focuses the search box', async ({ page }) => {
    await page.goto('/docs/user-guide/vi/admin/05-quan-ly-chuyen-di.html');
    await page.keyboard.press('/');
    await expect(page.locator('#guide-search-input')).toBeFocused();
  });
});
