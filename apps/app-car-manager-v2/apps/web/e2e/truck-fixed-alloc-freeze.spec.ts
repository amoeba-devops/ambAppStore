import { test, expect, type Page } from '@playwright/test';
import { devLogin, clearSession } from './helpers/auth';
import {
  DEV_ENT,
  MONTH,
  VEH_DONGNAI,
  seedTruckAllocationFixture,
  seedDongNaiFixedCost,
  addThirdDongNaiTrip,
  softDeleteThirdDongNaiTrip,
  latestReportFixedAlloc,
  nullifyReportFixedAlloc,
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

    /* Lập báo cáo → freeze. First generation compiles the action + workbook
     * builder on-demand in dev mode — poll generously (config docs the flake). */
    await gotoStable(page, `/truck/reports/new?month=${MONTH}&regions=DONG_NAI&vf=DONG_NAI:ALL`);
    await page.getByRole('button', { name: 'Lập báo cáo' }).click();
    await expect
      .poll(async () => (await latestReportFixedAlloc('DONG_NAI'))?.find((a) => a.vehicleId === VEH_DONGNAI)?.tripCount, {
        timeout: 90_000,
      })
      .toBe(2);
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
    await page.getByRole('button', { name: 'Lập báo cáo' }).click();
    await expect
      .poll(async () => (await latestReportFixedAlloc('DONG_NAI'))?.find((a) => a.vehicleId === VEH_DONGNAI)?.tripCount, {
        timeout: 90_000,
      })
      .toBe(3);

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
});
