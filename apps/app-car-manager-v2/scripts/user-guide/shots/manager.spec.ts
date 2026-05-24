import { test } from '@playwright/test';
import { resolve } from 'node:path';
import {
  loginAs,
  setUiLocale,
  waitForReady,
  captureRaw,
  snoozePushBanner,
  managerPresetFor,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  shotPath,
  RAW_OUT,
  PUBLISHED_OUT,
  type UiLocale,
} from './_helpers.js';
import { applyAnnotations, loadSpec } from '../annotate.js';

// Manager shots — both desktop (planning) and mobile (on-the-go check).
// Login preset: manager-vi → Lê Hoàng (UUID …200).

const TRIP_MGR_OWN     = '88888888-8888-8888-8888-888888888803'; // TR-3001 PENDING_ASSIGNMENT
const TRIP_MGR_CONFIRM = '88888888-8888-8888-8888-888888888804'; // TR-3002 CONFIRMED

async function shoot(
  page: import('@playwright/test').Page,
  locale: UiLocale,
  slug: string,
  opts: { fullPage?: boolean } = {},
) {
  const raw = shotPath(RAW_OUT, locale, 'manager', slug);
  const out = shotPath(PUBLISHED_OUT, locale, 'manager', slug);
  await captureRaw(page, raw, { fullPage: opts.fullPage ?? false });
  const specPath = resolve(import.meta.dirname, `annotations/manager-${slug}.shot.yml`);
  const spec = await loadSpec(specPath);
  await applyAnnotations(raw, spec, out);
}

// Desktop project — planning, trip create, costs ledger.
test.describe('Quản lý · Manager guide (desktop)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Desktop manager flows');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Dashboard (scope hẹp: chuyến của Manager)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/dashboard' });
    await waitForReady(page);
    await shoot(page, locale, '01-dashboard');
  });

  test('02 · /trips/new — Form tạo chuyến rỗng', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/trips/new' });
    await waitForReady(page);
    await shoot(page, locale, '02-trip-new-empty', { fullPage: true });
  });

  test('02 · /trips/new — Form đã điền', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/trips/new' });
    await waitForReady(page);

    // Locate inputs by placeholder (more stable than aria-label with Vietnamese
    // diacritics across case folding). Each form input has a placeholder string
    // unique to it, so we anchor on that.
    const pickup = page.getByPlaceholder(/toà nhà.*đường.*quận|nhập điểm đón/i).first();
    const dropoff = page.getByPlaceholder(/nhập điểm đến/i).first();
    if (await pickup.count()) await pickup.fill('Tòa nhà Bitexco, Quận 1');
    if (await dropoff.count()) await dropoff.fill('Khu công nghệ cao Quận 9');
    const dt = page.locator('input[type="datetime-local"]').first();
    if (await dt.count()) await dt.fill('2026-06-15T09:30');
    await page.waitForTimeout(300);
    await shoot(page, locale, '02-trip-new-filled', { fullPage: true });
  });

  test('03 · Danh sách chuyến của tôi', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/trips' });
    await waitForReady(page);
    await shoot(page, locale, '03-trips-list');
  });

  test('03 · Chi tiết chuyến TR-3001 (do Manager tạo)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: `/trips/${TRIP_MGR_OWN}` });
    await waitForReady(page);
    await shoot(page, locale, '03-trip-detail-own', { fullPage: true });
  });

  test('05 · /costs — Sổ chi phí (ledger view)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/costs' });
    await waitForReady(page);
    await shoot(page, locale, '05-costs-ledger');
  });

  test('04 · /expenses/new — Ghi chi phí (qua /costs)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/expenses/new' });
    await waitForReady(page);
    await shoot(page, locale, '04-expense-new', { fullPage: true });
  });
});

// Mobile project — manager on the go: quick status check, trip detail.
test.describe('Quản lý · Manager guide (mobile)', () => {
  test.beforeEach(async ({ context, baseURL }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'mobile', 'Mobile manager flows');
    await setUiLocale(context, uiLocaleFromTestInfo(info), baseURL!);
    await snoozePushBanner(context);
  });

  test('01 · Dashboard mobile', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: '/dashboard' });
    await waitForReady(page);
    await shoot(page, locale, '01-dashboard-mobile');
  });

  test('03 · Trip detail TR-3002 mobile (Manager = passenger)', async ({ page }, info) => {
    const locale = uiLocaleFromTestInfo(info);
    await loginAs(page, { preset: managerPresetFor(locale), next: `/trips/${TRIP_MGR_CONFIRM}` });
    await waitForReady(page);
    await shoot(page, locale, '03-trip-detail-passenger-mobile', { fullPage: true });
  });
});
