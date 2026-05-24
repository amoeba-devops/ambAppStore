import { test, expect } from '@playwright/test';
import {
  loginAs,
  setUiLocale,
  snoozePushBanner,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  adminPresetFor,
  driverPresetFor,
} from './_helpers.js';

// Verify that the "User Guide" entry points are wired correctly. The dropdown
// menu items in Radix UI live in a portal that only mounts when the menu is
// opened, so the simplest check is to assert the rendered anchor (in DOM after
// the menu opens, or directly on the page for the settings/me card) points at
// the right basePath-prefixed URL with target=_blank.

const EXPECTED_HREF_VI = '/docs/user-guide/vi/index.html';

test.describe('User guide entry points', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(uiLocaleFromTestInfo(info) !== 'vi', 'One locale is enough to verify URL wiring');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('sidebar dropdown → User Guide link visible after avatar click (desktop)', async ({ page }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop');
    await loginAs(page, { preset: adminPresetFor(uiLocaleFromTestInfo(info)), next: '/dashboard' });

    // Avatar lives inside the sidebar footer. Multiple buttons share the
    // same aria-label across the layout (DropdownMenuTrigger vs the avatar
    // wrapper button), so scope to the <aside> sidebar first.
    await page.locator('aside button[aria-label]', { has: page.locator('text="Nguyễn Thanh An"') })
      .first()
      .click({ trial: false });

    const link = page.locator(`a[href="${EXPECTED_HREF_VI}"]`).first();
    await expect(link).toBeVisible();
    expect(await link.getAttribute('target')).toBe('_blank');
    expect(await link.getAttribute('rel')).toContain('noopener');
  });

  test('settings/me card → User Guide link (desktop)', async ({ page }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop');
    await loginAs(page, { preset: adminPresetFor(uiLocaleFromTestInfo(info)), next: '/settings/me' });

    const link = page.locator('a[href*="docs/user-guide"]').first();
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe(EXPECTED_HREF_VI);
    expect(await link.getAttribute('target')).toBe('_blank');
  });

  test('settings/me card → User Guide link (mobile, driver)', async ({ page }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile');
    await loginAs(page, { preset: driverPresetFor(uiLocaleFromTestInfo(info)), next: '/settings/me' });

    // Multiple guide links now exist on mobile: top header icon (universal),
    // plus this page's own card. Scope to the main content area to assert the
    // card specifically renders and points at the same URL.
    const link = page.locator('main a[href*="docs/user-guide"]').first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe(EXPECTED_HREF_VI);
    expect(await link.getAttribute('target')).toBe('_blank');
  });

  test('mobile header icon → User Guide visible without scroll (universal)', async ({ page }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile');
    await loginAs(page, { preset: driverPresetFor(uiLocaleFromTestInfo(info)), next: '/today' });

    // The header icon is the always-visible entry — sits next to the Me avatar
    // at the top of every mobile page. No scroll required.
    const link = page.locator('.md\\:hidden a[href*="docs/user-guide"]').first();
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe(EXPECTED_HREF_VI);
    expect(await link.getAttribute('aria-label')).toMatch(/Hướng dẫn|guide/i);
  });

  test('desktop sidebar permanent row → User Guide visible without click', async ({ page }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop');
    await loginAs(page, { preset: adminPresetFor(uiLocaleFromTestInfo(info)), next: '/dashboard' });

    // The new permanent sidebar row — sits above the avatar dropdown, no
    // click needed. Scoped to <aside> to avoid matching the dropdown-menu
    // item (which only mounts when avatar is clicked).
    const link = page.locator('aside a[href*="docs/user-guide"]').first();
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe(EXPECTED_HREF_VI);
    expect(await link.getAttribute('target')).toBe('_blank');
  });

  test('User guide URL responds 200 with VI landing content', async ({ request }) => {
    const res = await request.get(EXPECTED_HREF_VI);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Bạn là ai');
  });
});
