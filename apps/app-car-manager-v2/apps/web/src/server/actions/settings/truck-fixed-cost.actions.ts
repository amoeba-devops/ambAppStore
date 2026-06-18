'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTruckFixedCosts } from '@car-v2/db/schema';
import { type ActionResult } from '@car-v2/shared/errors';
import { upsertTruckFixedCostSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
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
    return { ok: true as const };
  });
}
