import { test, expect, type Page } from '@playwright/test';
import { devLogin, clearSession } from './helpers/auth';
import {
  DEV_ENT,
  MONTH,
  seedTruckAllocationFixture,
  addThirdDongNaiInvoice,
  latestReportSnapshot,
  reportRowCount,
  teardownTruckAllocationFixture,
} from './helpers/truck-seed';

/**
 * "Lập báo cáo = tính lại & phân bổ theo công thức chốt sổ" (PLAN-20260707).
 *
 * Exercises the full loop on isolated DEV-entity data in month 2026-11:
 *   A. Allocatable region (DONG_NAI): review previews km × consumption × avg,
 *      generate freezes that snapshot onto the report row, finance shows it.
 *   B. Regenerate after adding an invoice recomputes a NEW snapshot.
 *   C. Region without invoices (HCM) → fallback "Tạm tính thủ công", fuel editable.
 *
 * Prereqs (same as the other specs): dev server on :3001 with DEMO_AUTO_LOGIN=true
 * and DATABASE_URL pointing at the dev Neon branch (Playwright loads it via dotenv).
 *
 * Next.js dev compiles routes on-demand and its RSC navigations intermittently
 * abort mid-compile (net::ERR_ABORTED — see playwright.config.ts). `gotoStable`
 * absorbs that; report assertions poll the DB (the source of truth) instead of
 * racing the client-side router.push after generation.
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

async function generate(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Lập báo cáo' }).click();
}

test.describe('Truck report allocation (PLAN-20260707)', () => {
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

  test('A — DONG_NAI: review previews allocation, generate freezes snapshot, finance shows it', async ({ page }) => {
    await gotoStable(page, `/truck/reports/new?month=${MONTH}&regions=DONG_NAI`);

    /* Allocatable mode badge + the reconciliation factors (avg 26.000, 0.333). */
    await expect(page.getByText('Phân bổ theo bình quân').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/26\.000\s*₫\/L/).first()).toBeVisible();
    await expect(page.getByText(/0\.333\s*L\/km/).first()).toBeVisible();
    /* Total allocated fuel reconciles to 100 L × 26.000 = 2.600.000. */
    await expect(page.getByText(/2\.600\.000\s*₫/).first()).toBeVisible();

    await generate(page);

    /* Snapshot frozen onto the report row (poll DB — the source of truth). */
    await expect
      .poll(async () => (await latestReportSnapshot('DONG_NAI'))?.avgPrice, { timeout: 30_000 })
      .toBe(26000);
    const snap = await latestReportSnapshot('DONG_NAI');
    expect(snap!.totalLiters).toBe(100);
    expect(snap!.totalKm).toBe(300);
    expect(snap!.consumption).toBeGreaterThan(0.33);
    expect(snap!.consumption).toBeLessThan(0.34);

    /* Finance screen reads the snapshot: "Đã lập BC" + allocated unit price, and
     * the fuel/price/liters cells are no longer provisional (italic). */
    await gotoStable(page, `/truck/finance?month=${MONTH}&region=DONG_NAI`);
    await expect(page.getByText(/Đã lập BC/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/26\.000\s*₫/).first()).toBeVisible();
    const italicCells = await page.locator('tbody td.italic, tbody td [class*="italic"]').count();
    expect(italicCells, 'allocated rows should not be italic/provisional').toBe(0);
  });

  test('B — regenerate after adding an invoice recomputes the snapshot', async ({ page }) => {
    await addThirdDongNaiInvoice(); // avg 26000→27333, consumption 0.333→0.5

    await gotoStable(page, `/truck/reports/new?month=${MONTH}&regions=DONG_NAI`);
    /* Preview reflects the LIVE recomputed factors, not the frozen old ones. */
    await expect(page.getByText(/27\.333\s*₫\/L/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/0\.500\s*L\/km/).first()).toBeVisible();

    await generate(page);

    await expect
      .poll(async () => (await latestReportSnapshot('DONG_NAI'))?.avgPrice, { timeout: 30_000 })
      .toBe(27333);
    const snap = await latestReportSnapshot('DONG_NAI');
    expect(snap!.totalLiters).toBe(150);
    expect(snap!.consumption).toBeGreaterThan(0.49);
    expect(snap!.consumption).toBeLessThan(0.51);
  });

  test('C — HCM (no invoices): fallback manual mode, fuel column editable', async ({ page }) => {
    await gotoStable(page, `/truck/reports/new?month=${MONTH}&regions=HCM`);

    await expect(page.getByText('Tạm tính thủ công').first()).toBeVisible({ timeout: 30_000 });

    /* Fallback keeps per-trip fuel hand-editable → a number input renders in the
     * fuel column (allocatable mode renders plain text instead). */
    const numberInputs = page.locator('input[type="number"]');
    await expect(numberInputs.first()).toBeVisible();
    expect(await numberInputs.count()).toBeGreaterThan(0);

    /* Generating without invoices still writes a report row, but freezes NO
     * snapshot (fuel stays each trip's own liters × price). */
    await generate(page);
    await expect.poll(async () => reportRowCount('HCM'), { timeout: 30_000 }).toBeGreaterThan(0);
    expect(await latestReportSnapshot('HCM'), 'no snapshot without invoices').toBeNull();
  });
});
