'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckFixedCosts, carVehicles } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { upsertTruckFixedCostSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { isTruckMonthClosed } from '@/server/queries/truck-finance.queries';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from '../_helpers';

/**
 * Upsert a truck's monthly fixed costs (salary/depreciation/insurance) — feeds
 * the P&L net-profit calc. One row per (ent, truck, month) via the unique
 * index; re-saving overwrites.
 */
export async function upsertTruckFixedCostAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const dto = upsertTruckFixedCostSchema.parse(input);
    /* Legacy manual closes lock the month — whole-fleet OR the vehicle's own
     * region close (the region check was missing before PLAN-20260707). Reports
     * don't lock; regenerating recomputes with the new fixed costs. */
    const [veh] = await db
      .select({ region: carVehicles.cvhRegion })
      .from(carVehicles)
      .where(
        and(
          eq(carVehicles.entId, actor.entId),
          eq(carVehicles.cvhId, dto.vehicle_id),
          isNull(carVehicles.cvhDeletedAt),
        ),
      )
      .limit(1);
    const closed =
      (await isTruckMonthClosed(actor.entId, dto.month)) ||
      (veh?.region != null && (await isTruckMonthClosed(actor.entId, dto.month, veh.region)));
    if (closed) {
      throw new CarError('CAR-E1002', 409, 'Financial month is closed');
    }

    await db
      .insert(carTruckFixedCosts)
      .values({
        tfcId: randomUUID(),
        entId: actor.entId,
        cvhId: dto.vehicle_id,
        tfcMonth: dto.month,
        tfcSalary: String(dto.salary),
        tfcDepreciation: String(dto.depreciation),
        tfcInsurance: String(dto.insurance),
      })
      .onConflictDoUpdate({
        target: [carTruckFixedCosts.entId, carTruckFixedCosts.cvhId, carTruckFixedCosts.tfcMonth],
        set: {
          tfcSalary: String(dto.salary),
          tfcDepreciation: String(dto.depreciation),
          tfcInsurance: String(dto.insurance),
          tfcUpdatedAt: new Date(),
        },
      });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_FIXED_COST.UPSERT',
      entity: 'Vehicle',
      entityId: dto.vehicle_id,
      after: { month: dto.month, salary: dto.salary, depreciation: dto.depreciation, insurance: dto.insurance },
    });

    revalidatePath('/truck/settings');
    revalidatePath('/truck/pnl');
    revalidatePath('/truck/dashboard');
    return { ok: true as const };
  });
}
