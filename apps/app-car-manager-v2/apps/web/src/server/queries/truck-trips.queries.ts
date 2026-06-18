import 'server-only';
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carTripExtraCosts, carDrivers, carUsers, type CarTripStatus } from '@car-v2/db/schema';
import { computeTruckCost, parseAmount, type TruckCostBreakdown } from '@car-v2/core/truck';

export interface TruckTripRow {
  trpId: string;
  ref: string;
  scheduledAt: Date;
  customer: string | null;
  bol: string | null;
  status: CarTripStatus;
  /** Distance = end − start odometer when both present. */
  km: number | null;
  breakdown: TruckCostBreakdown;
}

export interface ListTruckTripsOpts {
  /** Free-text on customer / BOL / ref. */
  q?: string;
  /** Restrict to one month, 'YYYY-MM'. */
  month?: string;
}

/** Truck trip-log rows (newest first) with per-trip cost/profit computed from
 * the same core math the completion flow uses. Optional search + month filter. */
export async function listTruckTrips(entId: string, opts: ListTruckTripsOpts = {}): Promise<TruckTripRow[]> {
  const filters: SQL[] = [
    eq(carTrips.entId, entId),
    eq(carTrips.trpKind, 'LOG'),
    isNull(carTrips.trpDeletedAt),
  ];
  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const start = new Date(`${opts.month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    filters.push(gte(carTrips.trpScheduledAt, start), lt(carTrips.trpScheduledAt, end));
  }
  const term = opts.q?.trim();
  if (term) {
    const like = `%${term}%`;
    const search = or(
      ilike(carTrips.trpCustomer, like),
      ilike(carTrips.trpBol, like),
      ilike(carTrips.trpRef, like),
    );
    if (search) filters.push(search);
  }

  const trips = await db
    .select()
    .from(carTrips)
    .where(and(...filters))
    .orderBy(desc(carTrips.trpScheduledAt));

  const ids = trips.map((t) => t.trpId);
  const extras = ids.length
    ? await db
        .select({ trpId: carTripExtraCosts.trpId, amount: carTripExtraCosts.tecAmount })
        .from(carTripExtraCosts)
        .where(and(eq(carTripExtraCosts.entId, entId), inArray(carTripExtraCosts.trpId, ids)))
    : [];
  const extraByTrip = new Map<string, number[]>();
  for (const e of extras) {
    const arr = extraByTrip.get(e.trpId) ?? [];
    arr.push(parseAmount(e.amount));
    extraByTrip.set(e.trpId, arr);
  }

  return trips.map((t) => ({
    trpId: t.trpId,
    ref: t.trpRef,
    scheduledAt: t.trpScheduledAt,
    customer: t.trpCustomer,
    bol: t.trpBol,
    status: t.trpStatus,
    km:
      t.trpStartOdometer != null && t.trpEndOdometer != null
        ? t.trpEndOdometer - t.trpStartOdometer
        : null,
    breakdown: computeTruckCost({
      fuelLiters: parseAmount(t.trpFuelLiters),
      fuelPrice: parseAmount(t.trpFuelPrice),
      tollFee: parseAmount(t.trpTollFee),
      extraCosts: extraByTrip.get(t.trpId) ?? [],
      revenue: parseAmount(t.trpRevenue),
    }),
  }));
}

/** Most recent driver per truck (derived from trip-log history) — keyed by
 * vehicle id. Trucks aren't statically assigned a driver, so the fleet card
 * shows whoever drove the latest logged trip. */
export async function getLatestTruckDrivers(entId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      vehicleId: carTrips.trpVehicleId,
      driverName: carUsers.usrName,
      scheduledAt: carTrips.trpScheduledAt,
    })
    .from(carTrips)
    .leftJoin(carDrivers, eq(carTrips.trpDriverId, carDrivers.drvId))
    .leftJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        isNotNull(carTrips.trpVehicleId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .orderBy(desc(carTrips.trpScheduledAt));

  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.vehicleId && r.driverName && !map.has(r.vehicleId)) map.set(r.vehicleId, r.driverName);
  }
  return map;
}

/** Structured extra-cost rows for one truck trip (detail breakdown). */
export async function getTripExtraCosts(
  entId: string,
  tripId: string,
): Promise<{ name: string; amount: number }[]> {
  const rows = await db
    .select({ name: carTripExtraCosts.tecName, amount: carTripExtraCosts.tecAmount })
    .from(carTripExtraCosts)
    .where(and(eq(carTripExtraCosts.entId, entId), eq(carTripExtraCosts.trpId, tripId)))
    .orderBy(carTripExtraCosts.tecCreatedAt);
  return rows.map((r) => ({ name: r.name, amount: parseAmount(r.amount) }));
}
