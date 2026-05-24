import { test } from '@playwright/test';
import { resolve } from 'node:path';
import {
  loginAs,
  setUiLocale,
  waitForReady,
  captureRaw,
  snoozePushBanner,
  adminPresetFor,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  shotPath,
  RAW_OUT,
  PUBLISHED_OUT,
  type UiLocale,
} from './_helpers.js';
import { applyAnnotations, loadSpec } from '../annotate.js';

// Admin shots — desktop-only (Admin tools aren't optimized for mobile).
// Login preset: admin-vi → Nguyễn Thanh An, role OWNER (mapped to ADMIN).
//
// 15 shots covering all 11 admin sections. Each section has the "anchor" view
// — adding zoomed/secondary shots is deferred to a polish pass if needed.

// Trip IDs from base seed + user-guide seed
const TRIP_PENDING_ASSIGN = '44444444-4444-4444-4444-444444444403'; // TR-1040 PENDING_ASSIGNMENT
const TRIP_INPROGRESS     = '44444444-4444-4444-4444-444444444401'; // TR-1042 IN_PROGRESS

// Vehicle IDs
const VEH_STARIA = '33333333-3333-3333-3333-333333333301';
// Driver IDs
const DRV_TU = '22222222-2222-2222-2222-222222222201';

async function shoot(
  page: import('@playwright/test').Page,
  locale: UiLocale,
  slug: string,
  opts: { fullPage?: boolean } = {},
) {
  const raw = shotPath(RAW_OUT, locale, 'admin', slug);
  const out = shotPath(PUBLISHED_OUT, locale, 'admin', slug);
  await captureRaw(page, raw, { fullPage: opts.fullPage ?? false });
  const specPath = resolve(import.meta.dirname, `annotations/admin-${slug}.shot.yml`);
  const spec = await loadSpec(specPath);
  await applyAnnotations(raw, spec, out);
}

test.describe('Quản trị viên · Admin guide (desktop)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Admin shots are desktop-only');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Dashboard admin (scope toàn công ty)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/dashboard' });
    await waitForReady(page);
    await shoot(page, locale, '01-dashboard');
  });

  test('02 · Vehicles list (card grid + status)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/vehicles' });
    await waitForReady(page);
    await shoot(page, locale, '02-vehicles-list');
  });

  test('02 · Vehicle detail (tabs: trips/docs/maintenance)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: `/vehicles/${VEH_STARIA}` });
    await waitForReady(page);
    await shoot(page, locale, '02-vehicle-detail', { fullPage: true });
  });

  test('02 · Vehicle form (new)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/vehicles/new' });
    await waitForReady(page);
    await shoot(page, locale, '02-vehicle-form', { fullPage: true });
  });

  test('03 · Drivers list', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/drivers' });
    await waitForReady(page);
    await shoot(page, locale, '03-drivers-list');
  });

  test('03 · Driver form (new)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/drivers/new' });
    await waitForReady(page);
    await shoot(page, locale, '03-driver-form', { fullPage: true });
  });

  test('04 · Users list (with AMA role + last active)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/users' });
    await waitForReady(page);
    await shoot(page, locale, '04-users-list');
  });

  test('04 · User invite form', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/users/new' });
    await waitForReady(page);
    await shoot(page, locale, '04-user-invite', { fullPage: true });
  });

  test('05 · Trip detail PENDING_ASSIGNMENT (Admin assign buttons)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: `/trips/${TRIP_PENDING_ASSIGN}` });
    await waitForReady(page);
    await shoot(page, locale, '05-trip-assign', { fullPage: true });
  });

  test('05 · Trip detail IN_PROGRESS (Admin monitoring view)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: `/trips/${TRIP_INPROGRESS}` });
    await waitForReady(page);
    await shoot(page, locale, '05-trip-monitor', { fullPage: true });
  });

  test('06 · /costs — Admin sees all expenses (ledger)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/costs' });
    await waitForReady(page);
    await shoot(page, locale, '06-costs-admin');
  });

  test('07 · Maintenance — vehicle maintenance tab', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: `/vehicles/${VEH_STARIA}` });
    await waitForReady(page);
    // Click the Maintenance tab if present — fallback to general detail shot
    const tab = page.getByRole('tab', { name: /bảo dưỡng|maintenance/i }).first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(400);
    }
    await shoot(page, locale, '07-maintenance-tab');
  });

  test('08 · Reports — KPI + charts', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/reports' });
    await waitForReady(page);
    await shoot(page, locale, '08-reports', { fullPage: true });
  });

  test('09 · Settings — General + Notifications + Retention', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/settings' });
    await waitForReady(page);
    await shoot(page, locale, '09-settings', { fullPage: true });
  });

  test('10 · Audit log — append-only history', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: adminPresetFor(locale), next: '/audit' });
    await waitForReady(page);
    await shoot(page, locale, '10-audit-log');
  });
});
