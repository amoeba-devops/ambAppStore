'server only';

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTripStopovers, type CarTripStopover } from '@car-v2/db/schema';

/** Ordered stopovers for a trip. Returns [] if none (backward compat). */
export async function getTripStopovers(
  entId: string,
  tripId: string,
): Promise<CarTripStopover[]> {
  return db.query.carTripStopovers.findMany({
    where: and(eq(carTripStopovers.tstTripId, tripId), eq(carTripStopovers.entId, entId)),
    orderBy: [asc(carTripStopovers.tstOrder)],
  });
}
