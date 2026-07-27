'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTruckFuelInvoices } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { isTruckMonthClosed } from '@/server/queries/truck-finance.queries';
import { runAction } from '../_helpers';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* Chốt sổ tay (closeTruckMonthAction / reopenTruckMonthAction) đã xóa —
 * PLAN-20260707: "Lập báo cáo" tự tính & đóng băng snapshot mỗi lần chạy
 * (generateTruckReportAction). Legacy close rows chỉ còn được ĐỌC (khóa tháng
 * cũ + snapshot lịch sử) qua isTruckMonthClosed / loadTruckRegionSnapshots. */

/* ── Hoá đơn xăng dầu tháng (fuel invoice ledger) ────────────────────────────── */
export async function addFuelInvoiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = z
      .object({
        date: z.string().regex(DATE),
        station: z.string().trim().max(120).optional(),
        region: z.enum(TRUCK_REGIONS),
        /* Vehicle the fuel was filled for (REQ-20260726) — drives the per-trip
         * allocation. Optional for backwards compatibility; without it the
         * invoice only feeds the legacy region-pool reconciliation. */
        vehicle_id: z.string().uuid().optional().or(z.literal('')),
        liters: z.number().nonnegative(),
        price: z.number().nonnegative(),
      })
      .parse(input);
    const month = dto.date.slice(0, 7);
    if (await isTruckMonthClosed(actor.entId, month, dto.region)) {
      throw new CarError('CAR-E1002', 409, 'Financial month is closed for this region');
    }
    const id = randomUUID();
    await db.insert(carTruckFuelInvoices).values({
      tfiId: id,
      entId: actor.entId,
      tfiVehicleType: 'TRUCK',
      tfiMonth: month,
      tfiRegion: dto.region,
      tfiVehicleId: dto.vehicle_id || null,
      tfiDate: dto.date,
      tfiStation: dto.station ?? null,
      tfiLiters: String(dto.liters),
      tfiPrice: String(dto.price),
      tfiCreatedBy: actor.userId,
    });
    revalidatePath('/truck/pnl');
    return { id };
  });
}

export async function deleteFuelInvoiceAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const { id } = z.object({ id: z.string().uuid() }).parse(input);
    /* Same legacy-close guard as add — a closed (month, region) must keep the
     * invoice set its snapshot was computed from (gap fixed in PLAN-20260707). */
    const [inv] = await db
      .select({ month: carTruckFuelInvoices.tfiMonth, region: carTruckFuelInvoices.tfiRegion })
      .from(carTruckFuelInvoices)
      .where(
        and(
          eq(carTruckFuelInvoices.entId, actor.entId),
          eq(carTruckFuelInvoices.tfiId, id),
          isNull(carTruckFuelInvoices.tfiDeletedAt),
        ),
      )
      .limit(1);
    if (!inv) throw new CarError('CAR-E0404', 404, 'Invoice not found');
    const closed =
      (await isTruckMonthClosed(actor.entId, inv.month)) ||
      (inv.region != null && (await isTruckMonthClosed(actor.entId, inv.month, inv.region)));
    if (closed) {
      throw new CarError('CAR-E1002', 409, 'Financial month is closed for this region');
    }
    const [row] = await db
      .update(carTruckFuelInvoices)
      .set({ tfiDeletedAt: new Date() })
      .where(
        and(
          eq(carTruckFuelInvoices.entId, actor.entId),
          eq(carTruckFuelInvoices.tfiId, id),
          isNull(carTruckFuelInvoices.tfiDeletedAt),
        ),
      )
      .returning({ id: carTruckFuelInvoices.tfiId });
    if (!row) throw new CarError('CAR-E0404', 404, 'Invoice not found');
    revalidatePath('/truck/pnl');
    return { ok: true as const };
  });
}
