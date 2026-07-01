import { test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import {
  setUiLocale,
  snoozePushBanner,
  waitForReady,
  captureRaw,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  PUBLISHED_OUT,
  type UiLocale,
} from './_helpers.js';

// Truck Driver surface shots (DRIVER, /today + /today/truck/*).
// Login: drv-truck persona — Trần Văn Sơn, TRUCK fleet, has open trips.
const DRV = { role: 'MEMBER', sub: '0a0a0a0a-0000-4000-8000-0000000000d2', name: 'Trần Văn Sơn' };
const TRIP_OPEN = 'd9000000-0000-4000-8000-000000009001'; // TRK-9001 CONFIRMED → completion form

async function driverLogin(page: Page, next: string) {
  const params = new URLSearchParams({ role: DRV.role, sub: DRV.sub, name: DRV.name, next });
  await page.goto(`/dev-login?${params}`, { waitUntil: 'networkidle' });
  await page.waitForURL((u) => !/\/dev-login(\?|$|#)/.test(u.toString()), { timeout: 15_000 });
}

async function waitNoSkeleton(page: Page) {
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 15_000 });
  await waitForReady(page);
}

async function shoot(page: Page, locale: UiLocale, slug: string, opts: { fullPage?: boolean } = {}) {
  const out = resolve(PUBLISHED_OUT, locale, 'truck-driver', `${slug}.png`);
  await captureRaw(page, out, { fullPage: opts.fullPage ?? false });
}

test.describe('Xe tải · Tài xế (desktop)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Desktop driver flows');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Hôm nay (desktop)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await driverLogin(page, '/today');
    await waitNoSkeleton(page);
    await shoot(page, locale, '01-today');
  });

  test('02 · Hoàn thành chuyến (desktop)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await driverLogin(page, `/today/truck/${TRIP_OPEN}`);
    await waitNoSkeleton(page);
    await shoot(page, locale, '02-trip-complete', { fullPage: true });
  });
});

test.describe('Xe tải · Tài xế (mobile)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile', 'Mobile driver flows (PWA-first)');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Hôm nay (mobile)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await driverLogin(page, '/today');
    await waitNoSkeleton(page);
    await shoot(page, locale, '01-today-mobile', { fullPage: true });
  });

  test('02 · Hoàn thành chuyến (mobile)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await driverLogin(page, `/today/truck/${TRIP_OPEN}`);
    await waitNoSkeleton(page);
    await shoot(page, locale, '02-trip-complete-mobile', { fullPage: true });
  });

  test('03 · Ghi chuyến mới (mobile)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await driverLogin(page, '/today/truck/new');
    await waitNoSkeleton(page);
    await shoot(page, locale, '03-trip-new-mobile', { fullPage: true });
  });
});
