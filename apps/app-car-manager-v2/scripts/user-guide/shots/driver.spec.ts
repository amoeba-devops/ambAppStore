import { test } from '@playwright/test';
import { resolve } from 'node:path';
import {
  loginAs,
  setUiLocale,
  waitForReady,
  assertLocale,
  captureRaw,
  snoozePushBanner,
  driverPresetFor,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  shotPath,
  RAW_OUT,
  PUBLISHED_OUT,
  type UiLocale,
} from './_helpers.js';
import { applyAnnotations, loadSpec } from '../annotate.js';

// Driver shots — mobile-only (iPhone 14 viewport 390×844). Login uses the
// driver-vi preset which maps to Nguyễn Văn Tú (UUID …101). The seed has
// trips assigned to him across the full lifecycle so we can shoot each state.
//
// Trip refs used:
//   TR-2001 — PENDING_DRIVER_CONFIRMATION (confirm/reject buttons)
//   TR-2002 — CONFIRMED (start button)
//   TR-1042 — IN_PROGRESS (end button)

const TRIP_PENDING   = '88888888-8888-8888-8888-888888888801';
const TRIP_CONFIRMED = '88888888-8888-8888-8888-888888888802';
const TRIP_RUNNING   = '44444444-4444-4444-4444-444444444401';

async function shoot(
  page: import('@playwright/test').Page,
  locale: UiLocale,
  slug: string,
  annotation?: string,
  opts: { fullPage?: boolean } = {},
) {
  const raw = shotPath(RAW_OUT, locale, 'driver', slug);
  const out = shotPath(PUBLISHED_OUT, locale, 'driver', slug);
  await captureRaw(page, raw, { fullPage: opts.fullPage ?? false });
  const specPath = annotation
    ? resolve(import.meta.dirname, `annotations/${annotation}`)
    : resolve(import.meta.dirname, `annotations/driver-${slug}.shot.yml`);
  const spec = await loadSpec(specPath);
  await applyAnnotations(raw, spec, out);
}

test.describe('Tài xế · Driver guide', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile', 'Driver shots are mobile-only');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('02 · Today screen — hero next trip', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/today' });
    await assertLocale(page, locale);
    await waitForReady(page);
    await shoot(page, locale, '02-today-overview');
  });

  test('02 · Today screen — full scroll', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/today' });
    await waitForReady(page);
    await shoot(page, locale, '02-today-full', undefined, { fullPage: true });
  });

  test('03 · Trip detail — PENDING_DRIVER_CONFIRMATION (Xác nhận / Từ chối)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: `/trips/${TRIP_PENDING}` });
    await waitForReady(page);
    await shoot(page, locale, '03-trip-pending-confirm', undefined, { fullPage: true });
  });

  test('04 · Trip detail — CONFIRMED (Bắt đầu chuyến)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: `/trips/${TRIP_CONFIRMED}` });
    await waitForReady(page);
    await shoot(page, locale, '04-trip-start', undefined, { fullPage: true });
  });

  test('04 · Trip detail — IN_PROGRESS (Kết thúc chuyến)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: `/trips/${TRIP_RUNNING}` });
    await waitForReady(page);
    await shoot(page, locale, '04-trip-end', undefined, { fullPage: true });
  });

  test('02 · My trips list', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/trips' });
    await waitForReady(page);
    await shoot(page, locale, '02-trips-list', undefined, { fullPage: false });
  });

  test('05 · Expense list (driver scope)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/expenses' });
    await waitForReady(page);
    await shoot(page, locale, '05-expense-list', undefined, { fullPage: false });
  });

  test('05 · New expense — empty form (type grid)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/expenses/new' });
    await waitForReady(page);
    await shoot(page, locale, '05-expense-new-empty', undefined, { fullPage: true });
  });

  test('05 · New expense — type selected (FUEL)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/expenses/new' });
    await waitForReady(page);
    // Click the FUEL chip — selector by ARIA radio role + Vietnamese label.
    const fuelChip = page.getByRole('radio').first(); // FUEL is first in grid
    await fuelChip.click();
    await page.waitForTimeout(300); // selection animation
    await shoot(page, locale, '05-expense-new-fuel-selected', undefined, { fullPage: true });
  });

  test('06 · Inbox — maintenance alerts (driver view)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/inbox' });
    await waitForReady(page);
    await shoot(page, locale, '06-inbox-maintenance');
  });

  test('00 · Settings — me page (driver profile)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: driverPresetFor(locale), next: '/settings/me' });
    await waitForReady(page);
    await shoot(page, locale, '00-settings-me', undefined, { fullPage: true });
  });
});
