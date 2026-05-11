import type { NextRequest } from 'next/server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { drivers, trips } from '@/lib/db/schema';
import { handleError, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/api/cron-guard';
import { notifyMany } from '@/lib/services/notification.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reminder cron — invoked every 15 minutes.
 * Notifies drivers about confirmed trips starting in the next 30–45 minute window
 * (so they get exactly one reminder ~30 min before).
 */
export async function GET(req: NextRequest) {
  try {
    requireCronSecret(req);

    // Window: trips starting between 25 and 35 minutes from now
    const now = new Date();
    const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 35 * 60 * 1000);

    // We compare against tripDate + tripTime → load CONFIRMED trips for today + tomorrow,
    // then filter in memory because Drizzle doesn't have a direct datetime concat helper.
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const candidates = await db
      .select({ trip: trips, driverUserId: drivers.userId })
      .from(trips)
      .innerJoin(drivers, eq(drivers.id, trips.driverId))
      .where(
        and(
          eq(trips.status, 'CONFIRMED'),
          gte(trips.tripDate, todayStr),
          lte(trips.tripDate, tomorrow),
        ),
      );

    const notes = [];
    for (const { trip, driverUserId } of candidates) {
      if (!driverUserId) continue;
      const start = new Date(`${trip.tripDate}T${trip.tripTime.slice(0, 5)}:00+07:00`);
      if (start >= windowStart && start <= windowEnd) {
        notes.push({
          userId: driverUserId,
          type: 'trip_reminder',
          title: 'Trip starting soon',
          body: `Trip at ${trip.tripTime.slice(0, 5)} today — please be ready`,
          payload: { tripId: trip.id },
        });
      }
    }

    await notifyMany(notes);
    return ok({ checked: true, candidates: candidates.length, notified: notes.length });
  } catch (err) {
    return handleError(err);
  }
}
