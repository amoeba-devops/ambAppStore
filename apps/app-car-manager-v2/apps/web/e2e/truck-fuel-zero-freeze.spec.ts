import { test, expect, type Page } from '@playwright/test';
import { devLogin, clearSession } from './helpers/auth';
import {
  DEV_ENT,
  MONTH2,
  VEH_HCM,
  seedTruckAllocationFixture,
  seedZeroFuelMonth,
  addFuelTripMonth2,
  latestReportVehicleFuel,
  teardownTruckAllocationFixture,
} from './helpers/truck-seed';

/**
 * Fuel-zero freeze (REQ-20260821 follow-up). Split out of the former
 * truck-fixed-alloc-freeze.spec.ts when REQ-20260908 dropped per-trip
 * salary/depreciation allocation entirely — these two cases test the
 * UNRELATED fuel-snapshot freeze, which still applies.
 *
 * A vehicle with NO allocatable fuel at "Lập báo cáo" time gets an explicit
 * ZERO frozen onto the report row, so fuel recorded afterwards doesn't
 * retro-cost a trip the report already covered.
 *
 * Prereqs (same as truck-report-allocation.spec): dev server on :3001 with
 * DEMO_AUTO_LOGIN=true, DATABASE_URL = dev Neon branch.
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

test.describe('Truck fuel-zero freeze (REQ-20260821 follow-up)', () => {
  test.beforeAll(async () => {
    await seedTruckAllocationFixture();
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
