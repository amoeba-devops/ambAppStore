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

/** slug · route · fullPage(desktop). Every page is shot on BOTH desktop and
 * mobile so the guide can show each surface at its correct breakpoint. */
const PAGES: { slug: string; route: string; full?: boolean }[] = [
  { slug: '01-dashboard', route: '/truck/dashboard' },
  { slug: '02-trips-list', route: '/truck/trips' },
  { slug: '03-trip-new', route: '/truck/trips/new', full: true },
  { slug: '04-trip-detail', route: `/truck/trips/${TRIP_DONE}`, full: true },
  { slug: '05-fleet', route: '/truck/fleet' },
  { slug: '06-drivers', route: '/truck/drivers' },
  { slug: '07-finance', route: '/truck/finance' },
  { slug: '08-pnl', route: '/truck/pnl' },
  { slug: '09-reports', route: '/truck/reports' },
  { slug: '10-report-new', route: '/truck/reports/new', full: true },
];

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

test.describe('Xe tải · Quản lý', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  for (const pg of PAGES) {
    test(`${pg.slug} · desktop`, async ({ page }, info) => {
      test.skip(deviceFromTestInfo(info) !== 'desktop', 'desktop only');
      const locale = uiLocaleFromTestInfo(info);
      await truckLogin(page, pg.route);
      await waitNoSkeleton(page);
      await shoot(page, locale, pg.slug, { fullPage: pg.full });
    });

    test(`${pg.slug} · mobile`, async ({ page }, info) => {
      test.skip(deviceFromTestInfo(info) !== 'mobile', 'mobile only');
      const locale = uiLocaleFromTestInfo(info);
      await truckLogin(page, pg.route);
      await waitNoSkeleton(page);
      // Full-page on mobile so the whole stacked layout is captured.
      await shoot(page, locale, `${pg.slug}-mobile`, { fullPage: true });
    });
  }
});
