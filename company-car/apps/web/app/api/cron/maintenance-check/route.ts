import type { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { systemSettings, users, vehicles } from '@/lib/db/schema';
import { handleError, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/cron-guard';
import { notifyMany } from '@/lib/services/notification.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily cron — invoked by Render Cron Jobs at ~02:00 GMT+7.
 * Computes vehicles approaching their oil-change interval and notifies admins.
 *   Trigger when: current_km - last_oil_change_km >= interval - warning_km   (PRD BR-13)
 */
export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);

    const [warnRow] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'oil_change_warning_km'))
      .limit(1);
    const warningKm = typeof warnRow?.value === 'number' ? warnRow.value : 500;

    const dueVehicles = await db
      .select()
      .from(vehicles)
      .where(
        sql`${vehicles.currentKm} - ${vehicles.lastOilChangeKm} >= ${vehicles.oilChangeIntervalKm} - ${warningKm}`,
      );

    if (dueVehicles.length === 0) {
      return ok({ checked: true, dueCount: 0, notified: 0 });
    }

    const admins = await db.select().from(users).where(eq(users.role, 'ADMIN'));

    const notes = admins.flatMap((a) =>
      dueVehicles.map((v) => ({
        userId: a.id,
        type: 'maintenance_due',
        title: 'Vehicle maintenance due',
        body: `${v.licensePlate} — ${v.currentKm - v.lastOilChangeKm} km since last oil change (interval ${v.oilChangeIntervalKm} km)`,
        payload: {
          vehicleId: v.id,
          licensePlate: v.licensePlate,
          currentKm: v.currentKm,
          lastOilChangeKm: v.lastOilChangeKm,
          interval: v.oilChangeIntervalKm,
        },
      })),
    );

    await notifyMany(notes);
    return ok({ checked: true, dueCount: dueVehicles.length, notified: notes.length });
  } catch (err) {
    return handleError(err);
  }
}
