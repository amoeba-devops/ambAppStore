import type { NextRequest } from 'next/server';
import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { drivers, systemSettings, users } from '@/lib/db/schema';
import { handleError, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/cron-guard';
import { notifyMany } from '@/lib/services/notification.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily cron — invoked by Render Cron Jobs at ~02:05 GMT+7.
 * Notifies admins about drivers whose licenses expire within the warning window. (PRD BR-14)
 */
export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);

    const [warnRow] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'license_expiry_warning_days'))
      .limit(1);
    const warningDays = typeof warnRow?.value === 'number' ? warnRow.value : 30;

    const cutoffDate = new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const expiring = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.status, 'ACTIVE'), lte(drivers.licenseExpiryDate, cutoffDate)));

    if (expiring.length === 0) {
      return ok({ checked: true, expiringCount: 0, notified: 0 });
    }

    const admins = await db.select().from(users).where(eq(users.role, 'ADMIN'));
    const notes = admins.flatMap((a) =>
      expiring.map((d) => ({
        userId: a.id,
        type: 'license_expiring',
        title: 'Driver license expiring soon',
        body: `${d.fullName} — license ${d.licenseNumber} expires on ${d.licenseExpiryDate}`,
        payload: {
          driverId: d.id,
          licenseNumber: d.licenseNumber,
          expiryDate: d.licenseExpiryDate,
        },
      })),
    );

    await notifyMany(notes);
    return ok({ checked: true, expiringCount: expiring.length, notified: notes.length });
  } catch (err) {
    return handleError(err);
  }
}
