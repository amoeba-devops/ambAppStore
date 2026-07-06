import 'server-only';
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, type SQL } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carTripExtraCosts,
  carDrivers,
  carUsers,
  carVehicles,
  type CarTripStatus,
} from '@car-v2/db/schema';
import {
  computeTruckCost,
  parseAmount,
  truckTripFuelCost,
  loadTruckRegionSnapshots,
  type TruckCostBreakdown,
} from '@car-v2/core/truck';

const monthKey = (d: Date): string => d.toISOString().slice(0, 7);

export interface TruckTripRow {
  trpId: string;
  ref: string;
  scheduledAt: Date;
  customer: string | null;
  bol: string | null;
  status: CarTripStatus;
  /** Vehicle plate / driver name for the trip-log table (design columns). */
  plate: string | null;
  /** Vehicle operating region code (cvh_region) — "Khu vực" column (QA P2). */
  region: string | null;
  driver: string | null;
  /** Distance = end − start odometer when both present. */
  km: number | null;
  breakdown: TruckCostBreakdown;
  updatedAt: Date | null;
  /** true once the trip's month is closed → fuel/profit are the official
   * month-end figures; false → provisional (liters × price). Lets list views
   * flag "Tạm tính" and keeps profit consistent with the finance/P&L screens. */
  finalized: boolean;
}

export interface ListTruckTripsOpts {
  /** Free-text on customer / BOL / ref. */
  q?: string;
  /** Restrict to one month, 'YYYY-MM'. */
  month?: string;
  /** Restrict to one vehicle. */
  vehicleId?: string;
  /** Restrict to one driver (Sheet-2 T7). */
  driverId?: string;
  /** Restrict to vehicles in one operating region (cvh_region code, QA P2). */
  region?: string;
  /** 'complete' = COMPLETED only · 'ongoing' = not completed · else all. */
  status?: 'all' | 'complete' | 'ongoing';
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
  if (opts.vehicleId) filters.push(eq(carTrips.trpVehicleId, opts.vehicleId));
  if (opts.driverId) filters.push(eq(carTrips.trpDriverId, opts.driverId));
  if (opts.status === 'complete') filters.push(eq(carTrips.trpStatus, 'COMPLETED'));
  else if (opts.status === 'ongoing') filters.push(ne(carTrips.trpStatus, 'COMPLETED'));
  /* Region scope (QA P2) — a trip's region is its vehicle's cvh_region, so
   * resolve the region's vehicle ids first. No vehicles in region → no rows. */
  if (opts.region) {
    const vrows = await db
      .select({ id: carVehicles.cvhId })
      .from(carVehicles)
      .where(
        and(
          eq(carVehicles.entId, entId),
          eq(carVehicles.cvhRegion, opts.region),
          isNull(carVehicles.cvhDeletedAt),
        ),
      );
    if (vrows.length === 0) return [];
    filters.push(inArray(carTrips.trpVehicleId, vrows.map((v) => v.id)));
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

  /* Plate + driver name for the table columns — batch lookups keep the main
   * query a flat select. */
  const vehIds = [...new Set(trips.map((t) => t.trpVehicleId).filter((v): v is string => !!v))];
  const plateByVeh = new Map<string, string>();
  const regionByVeh = new Map<string, string | null>();
  if (vehIds.length) {
    const vrows = await db
      .select({
        id: carVehicles.cvhId,
        plate: carVehicles.cvhPlateNumber,
        region: carVehicles.cvhRegion,
      })
      .from(carVehicles)
      .where(and(eq(carVehicles.entId, entId), inArray(carVehicles.cvhId, vehIds)));
    for (const v of vrows) {
      plateByVeh.set(v.id, v.plate);
      regionByVeh.set(v.id, v.region);
    }
  }
  const drvIds = [...new Set(trips.map((t) => t.trpDriverId).filter((v): v is string => !!v))];
  const driverByDrv = new Map<string, string>();
  if (drvIds.length) {
    const drows = await db
      .select({ id: carDrivers.drvId, name: carUsers.usrName })
      .from(carDrivers)
      .innerJoin(carUsers, eq(carDrivers.drvUserId, carUsers.usrId))
      .where(and(eq(carDrivers.entId, entId), inArray(carDrivers.drvId, drvIds)));
    for (const d of drows) if (d.name) driverByDrv.set(d.id, d.name);
  }

  /* Region-scoped month-end fuel snapshot (REQ-20260630). A trip's official
   * fuel uses ITS region's closed snapshot (km × consumption × avg price) so
   * per-trip profit matches the finance/P&L screens; otherwise liters × price. */
  const monthsInResult = [...new Set(trips.map((t) => monthKey(t.trpScheduledAt)))];
  const snapshots = await loadTruckRegionSnapshots(entId, monthsInResult);

  return trips.map((t) => {
    const km =
      t.trpStartOdometer != null && t.trpEndOdometer != null
        ? t.trpEndOdometer - t.trpStartOdometer
        : null;
    const extraCosts = extraByTrip.get(t.trpId) ?? [];
    const snap = snapshots.forTrip(monthKey(t.trpScheduledAt), t.trpVehicleId);

    let breakdown: TruckCostBreakdown;
    if (snap) {
      const fuelCost = truckTripFuelCost({ km: km ?? 0, consumption: snap.consumption, avgPrice: snap.avgPrice });
      const tollFee = Math.round(parseAmount(t.trpTollFee));
      const extraTotal = Math.round(extraCosts.reduce((s, n) => s + (n || 0), 0));
      const revenue = Math.round(parseAmount(t.trpRevenue));
      const totalCost = fuelCost + tollFee + extraTotal;
      breakdown = { fuelCost, tollFee, extraTotal, totalCost, revenue, profit: revenue - totalCost };
    } else {
      breakdown = computeTruckCost({
        fuelLiters: parseAmount(t.trpFuelLiters),
        fuelPrice: parseAmount(t.trpFuelPrice),
        tollFee: parseAmount(t.trpTollFee),
        extraCosts,
        revenue: parseAmount(t.trpRevenue),
      });
    }

    return {
      trpId: t.trpId,
      ref: t.trpRef,
      scheduledAt: t.trpScheduledAt,
      customer: t.trpCustomer,
      bol: t.trpBol,
      status: t.trpStatus,
      plate: t.trpVehicleId ? plateByVeh.get(t.trpVehicleId) ?? null : null,
      region: t.trpVehicleId ? regionByVeh.get(t.trpVehicleId) ?? null : null,
      driver: t.trpDriverId ? driverByDrv.get(t.trpDriverId) ?? null : null,
      km,
      breakdown,
      updatedAt: t.trpUpdatedAt,
      finalized: !!snap,
    };
  });
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

/** Most recent vehicle plate per driver (from trip-log history) — keyed by
 * driver id. Drivers aren't statically assigned a truck, so the roster shows
 * the latest one they drove. */
export async function getLatestVehiclesByDriver(entId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      driverId: carTrips.trpDriverId,
      plate: carVehicles.cvhPlateNumber,
      scheduledAt: carTrips.trpScheduledAt,
    })
    .from(carTrips)
    .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .where(
      and(
        eq(carTrips.entId, entId),
        eq(carTrips.trpKind, 'LOG'),
        isNotNull(carTrips.trpDriverId),
        isNotNull(carTrips.trpVehicleId),
        isNull(carTrips.trpDeletedAt),
      ),
    )
    .orderBy(desc(carTrips.trpScheduledAt));

  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.driverId && r.plate && !map.has(r.driverId)) map.set(r.driverId, r.plate);
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
