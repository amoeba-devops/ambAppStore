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

const PAGES: { slug: string; route: string; full?: boolean }[] = [
  { slug: '01-today', route: '/today' },
  { slug: '02-trip-complete', route: `/today/truck/${TRIP_OPEN}`, full: true },
  { slug: '03-trip-new', route: '/today/truck/new', full: true },
];

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

test.describe('Xe tải · Tài xế', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  for (const pg of PAGES) {
    test(`${pg.slug} · desktop`, async ({ page }, info) => {
      test.skip(deviceFromTestInfo(info) !== 'desktop', 'desktop only');
      const locale = uiLocaleFromTestInfo(info);
      await driverLogin(page, pg.route);
      await waitNoSkeleton(page);
      await shoot(page, locale, pg.slug, { fullPage: pg.full });
    });

    test(`${pg.slug} · mobile`, async ({ page }, info) => {
      test.skip(deviceFromTestInfo(info) !== 'mobile', 'mobile only');
      const locale = uiLocaleFromTestInfo(info);
      await driverLogin(page, pg.route);
      await waitNoSkeleton(page);
      await shoot(page, locale, `${pg.slug}-mobile`, { fullPage: true });
    });
  }
});
