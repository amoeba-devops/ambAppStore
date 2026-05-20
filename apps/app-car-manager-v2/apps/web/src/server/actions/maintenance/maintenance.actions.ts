'use server';
import { revalidatePath } from 'next/cache';
import {
  acknowledgeAlertSchema,
  resetOilChangeSchema,
} from '@car-v2/shared/zod';
import type { ActionResult } from '@car-v2/shared/errors';
import type { CarMaintenanceAlert, CarVehicle } from '@car-v2/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  acknowledgeAlert,
  resetOilChange,
} from '@/server/services/maintenance-alert.service';
import { runAction } from '../_helpers';

/**
 * Maintenance Server Actions — REQ-20260519 §3.7.
 *
 * acknowledge → Admin/Manager click "Đã xử lý" on an alert row
 * resetOil    → Admin manually sets last-oil-change without filing an expense
 */

export async function acknowledgeAlertAction(
  raw: unknown,
): Promise<ActionResult<CarMaintenanceAlert>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const input = acknowledgeAlertSchema.parse(raw);
    const updated = await acknowledgeAlert(input, actor);
    revalidatePath('/today');
    revalidatePath('/costs');
    return updated;
  });
}

export async function resetOilChangeAction(
  raw: unknown,
): Promise<ActionResult<CarVehicle>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    const input = resetOilChangeSchema.parse(raw);
    const updated = await resetOilChange(input, actor);
    revalidatePath('/today');
    revalidatePath('/costs');
    revalidatePath(`/vehicles/${input.vehicle_id}`);
    return updated;
  });
}
