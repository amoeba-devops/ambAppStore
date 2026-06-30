'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTruckMonthClose, carTruckFuelInvoices } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getTruckFuelStats, isTruckMonthClosed } from '@/server/queries/truck-finance.queries';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from '../_helpers';

const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateFinance(): void {
  revalidatePath('/truck/pnl');
  revalidatePath('/truck/finance');
  revalidatePath('/truck/dashboard');
  revalidatePath('/truck/trips');
}

/* ── Chốt sổ tháng (close the financial period) ─────────────────────────────── */
export async function closeTruckMonthAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const { month, region } = z
      .object({ month: z.string().regex(MONTH), region: z.enum(TRUCK_REGIONS) })
      .parse(input);

    if (await isTruckMonthClosed(actor.entId, month, region)) {
      throw new CarError('CAR-E0409', 409, 'Month already closed for this region');
    }

    /* Freeze the region's month-end fuel snapshot (avg price + consumption from
     * THIS region's invoices ÷ THIS region's trip km) so each trip's official
     * fuel cost = km × consumption × avgPrice is deterministic (REQ-20260630).
     * Only store it when computable; otherwise NULL → fall back to liters × price. */
    const snap = await getTruckFuelStats(actor.entId, month, region);
    const hasSnapshot = snap.totalKm > 0 && snap.invoiceLiters > 0 && snap.avgPrice > 0;

    await db.insert(carTruckMonthClose).values({
      tmcId: randomUUID(),
      entId: actor.entId,
      tmcVehicleType: 'TRUCK',
      tmcMonth: month,
      tmcRegion: region,
      tmcClosedBy: actor.userId,
      tmcAvgPrice: hasSnapshot ? String(snap.avgPrice) : null,
      tmcConsumption: hasSnapshot ? String(snap.consumption) : null,
      tmcTotalLiters: hasSnapshot ? String(snap.invoiceLiters) : null,
      tmcTotalKm: hasSnapshot ? String(snap.totalKm) : null,
    });
    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_MONTH.CLOSED',
      entity: 'TruckMonth',
      entityId: `${month}|${region}`,
      entityRef: `${month} · ${region}`,
      after: hasSnapshot
        ? { month, region, avgPrice: snap.avgPrice, consumption: snap.consumption, totalLiters: snap.invoiceLiters, totalKm: snap.totalKm }
        : { month, region },
    });
    revalidateFinance();
    return { ok: true as const };
  });
}

/* ── Mở lại tháng (reopen — mandatory reason) ────────────────────────────────── */
export async function reopenTruckMonthAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    /* Reopen rewrites an official, reported P&L → ADMIN only (design:
     * "Chỉ Quản trị viên"). Closing stays ADMIN|MANAGER. */
    requireRole(actor.role, ['ADMIN']);
    await requireFleet(actor, 'TRUCK');
    const { month, region, reason } = z
      .object({
        month: z.string().regex(MONTH),
        region: z.enum(TRUCK_REGIONS),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input);

    const [row] = await db
      .update(carTruckMonthClose)
      .set({
        tmcDeletedAt: new Date(),
        tmcReopenReason: reason,
        tmcReopenedBy: actor.userId,
        tmcReopenedAt: new Date(),
      })
      .where(
        and(
          eq(carTruckMonthClose.entId, actor.entId),
          eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
          eq(carTruckMonthClose.tmcMonth, month),
          eq(carTruckMonthClose.tmcRegion, region),
          isNull(carTruckMonthClose.tmcDeletedAt),
        ),
      )
      .returning({ id: carTruckMonthClose.tmcId });
    if (!row) throw new CarError('CAR-E0404', 404, 'Closed month not found');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_MONTH.REOPENED',
      entity: 'TruckMonth',
      entityId: `${month}|${region}`,
      entityRef: `${month} · ${region}`,
      after: { month, region, reason },
    });
    revalidateFinance();
    return { ok: true as const };
  });
}

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
