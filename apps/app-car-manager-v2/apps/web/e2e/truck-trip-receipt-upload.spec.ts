import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { neon } from '@neondatabase/serverless';
import { devLogin, clearSession } from './helpers/auth';
import { DEV_ENT, seedTruckAllocationFixture, teardownTruckAllocationFixture } from './helpers/truck-seed';

/**
 * Truck trip-cost receipt/invoice upload (REQ-20260709).
 *
 * Verifies the image+PDF attachment field on the truck cost forms:
 *   1. The receipt section renders (3 buckets: fuel / toll / extra) and accepts
 *      both an image and a PDF, showing thumbnails.
 *   2. Offline disables the attach control (first-cut: no offline queue).
 *   3. The trip detail renders persisted receipts grouped by cost.
 *   4. Creating a trip with a receipt persists a car_trip_cost_attachments row
 *      (write path) — S3 network is mocked so no bytes hit the real dev bucket.
 *
 * Prereqs (same as truck-report-allocation.spec): dev server on :3001 with
 * DEMO_AUTO_LOGIN=true and DATABASE_URL pointing at the dev Neon branch. The
 * car_trip_cost_attachments table (migration 0022) must be applied on that branch.
 */

const OWNER = { role: 'OWNER' as const, entId: DEV_ENT, sub: '00000000-0000-4000-8000-000000000001' };
const T_DN_1 = 'a11d0000-0000-4000-8000-0000000000d1'; // seeded DONG_NAI trip #1 (COMPLETED)
const SHOTS = 'e2e-shots';

/* 1×1 PNG + a tiny PDF — the server stores the S3 key only and never parses
 * bytes, so any content with the right MIME is enough for the flow. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n% receipt e2e fixture\n', 'utf8');

function db() {
  return neon(process.env.DATABASE_URL!);
}

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

test.describe('Truck trip-cost receipt upload (REQ-20260709)', () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test.beforeEach(async ({ page, context }) => {
    await clearSession(context);
    for (let i = 0; i < 3; i++) {
      try {
        await devLogin(page, OWNER);
        break;
      } catch (e) {
        if (i === 2 || !(e instanceof Error) || !/ERR_ABORTED/.test(e.message)) throw e;
        await page.waitForTimeout(1500);
      }
    }
  });

  test('1 — receipt fields render and accept image + PDF', async ({ page }) => {
    await gotoStable(page, '/truck/trips/new');

    /* The manager "log" shape is the default → the receipts block (3 buckets)
     * is present under the cost section. */
    await expect(page.getByText('Hóa đơn / chứng từ')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Hóa đơn nhiên liệu')).toBeVisible();
    await expect(page.getByText('Hóa đơn cầu đường')).toBeVisible();
    await expect(page.getByText('Chứng từ phí phát sinh')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-receipt-fields.png`, fullPage: true });

    /* Attach an image AND a PDF to the FUEL bucket (first file input). */
    const fuelInput = page.locator('input[type=file]').first();
    await fuelInput.setInputFiles([
      { name: 'fuel-receipt.png', mimeType: 'image/png', buffer: PNG },
      { name: 'fuel-invoice.pdf', mimeType: 'application/pdf', buffer: PDF },
    ]);

    /* Two tiles appear: an <img> preview + a PDF tile showing the "pdf" label. */
    await expect(page.getByText(/pdf/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('img[alt="fuel-receipt.png"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-files-picked.png`, fullPage: true });
  });

  test('2 — offline disables the attach control', async ({ page, context }) => {
    await gotoStable(page, '/truck/trips/new');
    await expect(page.getByRole('button', { name: 'Đính kèm' }).first()).toBeVisible({ timeout: 30_000 });

    await context.setOffline(true);
    await expect(page.getByText('Cần có mạng để đính kèm tệp').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}/03-offline.png`, fullPage: true });

    await context.setOffline(false);
  });

  test('3 — trip detail shows persisted receipts grouped by cost', async ({ page }) => {
    await seedTruckAllocationFixture();
    const q = db();
    const k1 = `${DEV_ENT}/trips/${OWNER.sub}/${randomUUID()}-fuel.png`;
    const k2 = `${DEV_ENT}/trips/${OWNER.sub}/${randomUUID()}-extra.pdf`;
    await q`DELETE FROM car_trip_cost_attachments WHERE trp_id = ${T_DN_1}`;
    await q`
      INSERT INTO car_trip_cost_attachments
        (tca_id, ent_id, trp_id, tca_cost_kind, tca_s3_key, tca_mime, tca_size_bytes)
      VALUES
        (${randomUUID()}, ${DEV_ENT}, ${T_DN_1}, 'FUEL',  ${k1}, 'image/png',       12345),
        (${randomUUID()}, ${DEV_ENT}, ${T_DN_1}, 'EXTRA', ${k2}, 'application/pdf',  23456)
    `;

    /* The detail <img> points at a signed S3 GET URL — fulfil it with our pixel
     * so the tile renders instead of 403-degrading. */
    await page.route(/amazonaws\.com/i, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
    );

    await gotoStable(page, `/truck/trips/${T_DN_1}`);
    await expect(page.getByText('Hóa đơn / chứng từ')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Phí phát sinh')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-detail-receipts.png`, fullPage: true });

    await q`DELETE FROM car_trip_cost_attachments WHERE trp_id = ${T_DN_1}`;
    await teardownTruckAllocationFixture();
  });

  test('4 — creating a trip with a receipt persists an attachment row (mocked S3)', async ({ page }) => {
    /* Mock the real S3 network: PUT (upload) 200, GET (later render) a pixel —
     * no bytes touch the dev bucket. */
    await page.route(/amazonaws\.com/i, (route) => {
      if (route.request().method() === 'PUT') return route.fulfill({ status: 200, body: '' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });

    await gotoStable(page, '/truck/trips/new');
    await expect(page.getByText('Hóa đơn / chứng từ')).toBeVisible({ timeout: 30_000 });

    /* Fill the required fields: vehicle + driver (Radix selects) + pickup +
     * dropoff addresses. */
    const combos = page.getByRole('combobox');
    await combos.nth(0).click();
    await page.getByRole('option').first().click();
    await combos.nth(1).click();
    await page.getByRole('option').first().click();
    await page.getByPlaceholder('Địa chỉ điểm lấy hàng').fill('Kho A, Biên Hòa');
    await page.getByPlaceholder('Địa chỉ điểm giao hàng').fill('Cảng Cát Lái, TP.HCM');

    /* Attach a fuel receipt. */
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'e2e-fuel.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    const q = db();
    await page.getByRole('button', { name: 'Lưu chuyến' }).click();
    /* Manager create redirects to the trip list. */
    await page.waitForURL(/\/truck\/trips\/?$/i, { timeout: 30_000 });

    /* A fresh LOG trip with a FUEL attachment must now exist (write path). */
    const findNewTripId = async (): Promise<string | null> => {
      const rows = await q`
        SELECT a.trp_id AS id
        FROM car_trip_cost_attachments a
        JOIN car_trips t ON t.trp_id = a.trp_id
        WHERE t.ent_id = ${DEV_ENT}
          AND t.trp_kind = 'LOG'
          AND a.tca_cost_kind = 'FUEL'
          AND a.tca_deleted_at IS NULL
          AND t.trp_created_at > now() - interval '3 minutes'
        ORDER BY t.trp_created_at DESC
        LIMIT 1`;
      return (rows[0]?.id as string | undefined) ?? null;
    };
    await expect.poll(findNewTripId, { timeout: 20_000 }).not.toBeNull();
    const newTripId = (await findNewTripId())!;

    /* Show it on the detail page too. */
    await gotoStable(page, `/truck/trips/${newTripId}`);
    await expect(page.getByText('Hóa đơn / chứng từ')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/05-detail-after-create.png`, fullPage: true });

    /* Cleanup the trip this test created (+ its children). */
    await q`DELETE FROM car_trip_cost_attachments WHERE trp_id = ${newTripId}`;
    await q`DELETE FROM car_trip_extra_costs WHERE trp_id = ${newTripId}`;
    await q`DELETE FROM car_trip_stopovers WHERE tst_trip_id = ${newTripId}`;
    await q`DELETE FROM car_trips WHERE trp_id = ${newTripId}`;
  });
});
