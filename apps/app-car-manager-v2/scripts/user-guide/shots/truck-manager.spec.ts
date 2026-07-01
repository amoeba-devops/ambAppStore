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

// Truck Manager surface shots (ADMIN/MANAGER workspace, /truck/*).
// Login: mgr-truck persona (role+sub+name) — Phạm Minh Quân, TRUCK fleet.
const MGR = { role: 'MANAGER', sub: '0a0a0a0a-0000-4000-8000-0000000000c2', name: 'Phạm Minh Quân' };
// A COMPLETED trip (TRK-1001) → 2-column cost/profit detail.
const TRIP_DONE = 'd7000000-0000-4000-8000-000000001001';

async function truckLogin(page: Page, next: string) {
  const params = new URLSearchParams({ role: MGR.role, sub: MGR.sub, name: MGR.name, next });
  await page.goto(`/dev-login?${params}`, { waitUntil: 'networkidle' });
  await page.waitForURL((u) => !/\/dev-login(\?|$|#)/.test(u.toString()), { timeout: 15_000 });
}

/** Wait until the app-shell/route loading skeleton is gone (guards the known
 * dev streaming-skeleton wedge — shots must show real content). */
async function waitNoSkeleton(page: Page) {
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 15_000 });
  await waitForReady(page);
}

async function shoot(page: Page, locale: UiLocale, slug: string, opts: { fullPage?: boolean } = {}) {
  const out = resolve(PUBLISHED_OUT, locale, 'truck-manager', `${slug}.png`);
  await captureRaw(page, out, { fullPage: opts.fullPage ?? false });
}

test.describe('Xe tải · Quản lý (desktop)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Desktop truck-manager flows');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Bảng điều khiển', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/dashboard');
    await waitNoSkeleton(page);
    await shoot(page, locale, '01-dashboard');
  });

  test('02 · Nhật ký chuyến', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/trips');
    await waitNoSkeleton(page);
    await shoot(page, locale, '02-trips-list');
  });

  test('03 · Lập chuyến (form)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/trips/new');
    await waitNoSkeleton(page);
    await shoot(page, locale, '03-trip-new', { fullPage: true });
  });

  test('04 · Chi tiết chuyến (đã hoàn thành, 2 cột)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, `/truck/trips/${TRIP_DONE}`);
    await waitNoSkeleton(page);
    await shoot(page, locale, '04-trip-detail', { fullPage: true });
  });

  test('05 · Đội xe', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/fleet');
    await waitNoSkeleton(page);
    await shoot(page, locale, '05-fleet');
  });

  test('06 · Tài xế', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/drivers');
    await waitNoSkeleton(page);
    await shoot(page, locale, '06-drivers');
  });

  test('07 · Chi phí & Lợi nhuận', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/finance');
    await waitNoSkeleton(page);
    await shoot(page, locale, '07-finance');
  });

  test('08 · Tổng quan P&L', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/pnl');
    await waitNoSkeleton(page);
    await shoot(page, locale, '08-pnl');
  });

  test('09 · Danh sách báo cáo', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/reports');
    await waitNoSkeleton(page);
    await shoot(page, locale, '09-reports');
  });

  test('10 · Lập báo cáo (chọn tháng)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/reports/new');
    await waitNoSkeleton(page);
    await shoot(page, locale, '10-report-new', { fullPage: true });
  });
});

test.describe('Xe tải · Quản lý (mobile)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile', 'Mobile truck-manager flows');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Bảng điều khiển (mobile)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await truckLogin(page, '/truck/dashboard');
    await waitNoSkeleton(page);
    await shoot(page, locale, '01-dashboard-mobile');
  });
});
