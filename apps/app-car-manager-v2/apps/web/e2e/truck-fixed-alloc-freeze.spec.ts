import { test, expect, type Page } from '@playwright/test';
import { devLogin, clearSession } from './helpers/auth';
import {
  DEV_ENT,
  MONTH,
  MONTH2,
  VEH_DONGNAI,
  VEH_HCM,
  seedTruckAllocationFixture,
  seedDongNaiFixedCost,
  addThirdDongNaiTrip,
  softDeleteThirdDongNaiTrip,
  latestReportFixedAlloc,
  nullifyReportFixedAlloc,
  seedZeroFuelMonth,
  addFuelTripMonth2,
  latestReportVehicleFuel,
  teardownTruckAllocationFixture,
} from './helpers/truck-seed';

/**
 * REQ-20260821 — "tạo chuyến không tính lại số nào; khi lập báo cáo mới tính".
 *
 * The per-trip fixed-cost share (lương/khấu hao ÷ số chuyến) is FROZEN by the
 * report that covers the trip (`trr_fixed_alloc`) and only ever (re)computed by
 * "Lập báo cáo". Trip CRUD between two reports must not move a reported trip's
 * share; trips logged after the report keep today's live provisional numbers
 * (no new UI — user decision 2026-08-21).
 *
 * Fixture: DONG_NAI, month 2026-11, manual fixed cost 9.000.000 lương +
 * 600.000 KH → share ÷2 chuyến = 4.500.000/300.000 · ÷3 = 3.000.000/200.000.
 *
 * Prereqs (same as truck-report-allocation.spec): dev server on :3001 with
 * DEMO_AUTO_LOGIN=true, DATABASE_URL = dev Neon branch, migration 0029 applied.
 */

const ADMIN = { role: 'OWNER' as const, entId: DEV_ENT, sub: '00000000-0000-4000-8000-000000000001' };

async function gotoStable(page: Page, path: string): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      return;
    } catch (e) {
      if (!(e instanceof Error) || !/ERR_ABORTED/.test(e.message)) throw e;
      lastErr = e;
      await page.waitForTimeout(1500);
    }
  }
  throw lastErr;
}

/** The finance row of one trip, located by its ref. Finance data rows are
 * `<tr role="link">` (ClickableTableRow) — invisible to getByRole('row'). */
function rowOf(page: Page, ref: string) {
  return page.locator('tr').filter({ hasText: ref });
}

/**
 * Click "Lập báo cáo" on the review step and wait until `ok()` sees the
 * generated row in the DB. A click fired right after domcontentloaded races
 * React hydration in dev mode — the handler isn't attached yet, so NOTHING
 * happens (run 2026-08-21: zero POSTs despite successful clicks). Wait for
 * networkidle (page chunk fetched) and re-click until the DB confirms, which
 * also absorbs a one-off failed generation. A successful run navigates away
 * (router.push → /truck/reports), so later iterations skip the vanished button
 * and just keep polling.
 */
async function clickGenerateUntil(page: Page, ok: () => Promise<boolean>): Promise<void> {
  const btn = page.getByRole('button', { name: 'Lập báo cáo' });
  await expect(btn).toBeEnabled({ timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      if (await ok()) return;
      await page.waitForTimeout(1_000);
    }
  }
  throw new Error('generation never landed in the DB');
}

test.describe('Truck fixed-alloc freeze (REQ-20260821)', () => {
  test.beforeAll(async () => {
    await seedTruckAllocationFixture();
    await seedDongNaiFixedCost(9_000_000, 600_000);
  });

  test.afterAll(async () => {
    await teardownTruckAllocationFixture();
  });

  test.beforeEach(async ({ page, context }) => {
    await clearSession(context);
    for (let i = 0; i < 3; i++) {
      try {
        await devLogin(page, ADMIN);
        break;
      } catch (e) {
        if (i === 2 || !(e instanceof Error) || !/ERR_ABORTED/.test(e.message)) throw e;
        await page.waitForTimeout(1500);
      }
    }
  });

  test('TC-01/02/03 — report freezes the share; a trip logged afterwards moves nothing', async ({ page }) => {
    /* Before any report: live allocation ÷2 (regression baseline, TC-07). */
    await gotoStable(page, `/truck/finance?month=${MONTH}&region=DONG_NAI`);
    await expect(rowOf(page, 'E2E-DN-1').getByText('4.500.000').first()).toBeVisible({ timeout: 30_000 });

    /* Lập báo cáo → freeze. */
    await gotoStable(page, `/truck/reports/new?month=${MONTH}&regions=DONG_NAI&vf=DONG_NAI:ALL`);
    await clickGenerateUntil(
      page,
      async () =>
        (await latestReportFixedAlloc('DONG_NAI'))?.find((a) => a.vehicleId === VEH_DONGNAI)?.tripCount === 2,
    );
    const frozen = (await latestReportFixedAlloc('DONG_NAI'))!.find((a) => a.vehicleId === VEH_DONGNAI)!;
    expect(frozen.salary).toBe(9_000_000);
    expect(frozen.depreciation).toBe(600_000);

    /* Log a 3rd trip AFTER the report — the core assertion of the REQ. */
    await addThirdDongNaiTrip();
    await gotoStable(page, `/truck/finance?month=${MONTH}&region=DONG_NAI`);
    /* Reported trips: share unchanged (frozen ÷2), NOT re-divided ÷3. */
    await expect(rowOf(page, 'E2E-DN-1').getByText('4.500.000').first()).toBeVisible({ timeout: 30_000 });
    await expect(rowOf(page, 'E2E-DN-2').getByText('4.500.000').first()).toBeVisible();
    /* The new trip itself: today's live provisional (÷3) — no new UI state. */
    await expect(rowOf(page, 'E2E-DN-3').getByText('3.000.000').first()).toBeVisible();
    await expect(rowOf(page, 'E2E-DN-1').getByText('3.000.000')).toHaveCount(0);
  });

  test('TC-04 — regenerating the report is THE recalculation moment (÷3)', async ({ page }) => {
    await gotoStable(page, `/truck/reports/new?month=${MONTH}&regions=DONG_NAI&vf=DONG_NAI:ALL`);
    await clickGenerateUntil(
      page,
      async () =>
        (await latestReportFixedAlloc('DONG_NAI'))?.find((a) => a.vehicleId === VEH_DONGNAI)?.tripCount === 3,
    );

    await gotoStable(page, `/truck/finance?month=${MONTH}&region=DONG_NAI`);
    await expect(rowOf(page, 'E2E-DN-1').getByText('3.000.000').first()).toBeVisible({ timeout: 30_000 });
    await expect(rowOf(page, 'E2E-DN-3').getByText('3.000.000').first()).toBeVisible();
    await expect(rowOf(page, 'E2E-DN-1').getByText('4.500.000')).toHaveCount(0);
  });

  test('TC-05 — deleting a trip after the report does NOT re-divide the frozen shares', async ({ page }) => {
    await softDeleteThirdDongNaiTrip();

    await gotoStable(page, `/truck/finance?month=${MONTH}&region=DONG_NAI`);
    /* Still the ÷3 share the last report froze — not back to ÷2. */
    await expect(rowOf(page, 'E2E-DN-1').getByText('3.000.000').first()).toBeVisible({ timeout: 30_000 });
    await expect(rowOf(page, 'E2E-DN-2').getByText('3.000.000').first()).toBeVisible();
    await expect(rowOf(page, 'E2E-DN-1').getByText('4.500.000')).toHaveCount(0);
  });

  test('TC-08 — a pre-0029 report (no frozen alloc) falls back to the live computation', async ({ page }) => {
    await nullifyReportFixedAlloc('DONG_NAI');

    await gotoStable(page, `/truck/finance?month=${MONTH}&region=DONG_NAI`);
    /* Live again: 2 completed trips remain → ÷2 = 4.500.000 (pre-0029 numbers). */
    await expect(rowOf(page, 'E2E-DN-1').getByText('4.500.000').first()).toBeVisible({ timeout: 30_000 });
    await expect(rowOf(page, 'E2E-DN-1').getByText('3.000.000')).toHaveCount(0);
  });

  /* ── Fuel-zero freeze (REQ-20260821 follow-up): the last recalculated column.
   * MONTH2, VEH_HCM: one trip with NO fuel → report freezes an explicit ZERO →
   * fuel recorded afterwards must not retro-cost the reported trip. Live pool
   * after the late fuel = 600.000 ÷ 150 km = 4.000 đ/km, so a leak would show
   * "× 4.000 đ/km" on the covered trip. ── */

  test('TC-13 — report freezes fuel ZERO; fuel recorded later does not retro-cost the covered trip', async ({ page }) => {
    await seedZeroFuelMonth();

    await gotoStable(page, `/truck/reports/new?month=${MONTH2}&regions=HCM&vf=HCM:ALL`);
    await clickGenerateUntil(
      page,
      async () => (await latestReportVehicleFuel(MONTH2, 'HCM'))?.find((v) => v.vehicleId === VEH_HCM)?.money === 0,
    );

    /* Fuel arrives AFTER the report. */
    await addFuelTripMonth2();
    await gotoStable(page, `/truck/finance?month=${MONTH2}&region=HCM`);
    /* Uncovered trip reads the live pool: 50 km × 4.000 đ/km = 200.000. */
    await expect(rowOf(page, 'E2E-HCM-4').getByText('200.000').first()).toBeVisible({ timeout: 30_000 });
    /* Covered trip stays at the frozen ZERO — no live rate on its row. */
    await expect(rowOf(page, 'E2E-HCM-3').getByText('4.000 đ/km')).toHaveCount(0);
    await expect(rowOf(page, 'E2E-HCM-3').getByText('400.000')).toHaveCount(0);
  });

  test('TC-14 — regenerating re-costs the zero-frozen trip from the new pool', async ({ page }) => {
    await gotoStable(page, `/truck/reports/new?month=${MONTH2}&regions=HCM&vf=HCM:ALL`);
    await clickGenerateUntil(
      page,
      async () =>
        (await latestReportVehicleFuel(MONTH2, 'HCM'))?.find((v) => v.vehicleId === VEH_HCM)?.money === 600_000,
    );

    await gotoStable(page, `/truck/finance?month=${MONTH2}&region=HCM`);
    /* Now frozen from the new pool: 100 km × 4.000 đ/km = 400.000. */
    await expect(rowOf(page, 'E2E-HCM-3').getByText('400.000').first()).toBeVisible({ timeout: 30_000 });
  });
});
