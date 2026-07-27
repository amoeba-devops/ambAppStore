import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carDrivers, carTrips, carTruckFixedCosts, carVehicles } from '@car-v2/db/schema';
import { parseAmount } from './truck-cost';

/**
 * Per-trip share of a truck's MONTHLY fixed cost (REQ-20260725, client Sheet3
 * "Chi phí lương phân bổ theo chuyến" / "Chi phí khấu hao phân bổ theo chuyến").
 *
 * The customer's sheet reports a per-trip profit that already carries its slice
 * of the month's fixed cost:
 *
 *   lương phân bổ    = lương tháng của xe/tài xế ÷ số chuyến của xe trong tháng
 *   khấu hao phân bổ = khấu hao tháng của xe     ÷ số chuyến của xe trong tháng
 *
 * The monthly source is EXACTLY the one `computeTruckPnl` uses, so Σ(shares)
 * reconciles with the month's `fixedCost`: a manual `car_truck_fixed_costs` row
 * for (vehicle, month) wins; otherwise the vehicle's own depreciation + its
 * default driver's fixed salary ("1 xe ↔ 1 tài xế").
 *
 * Allocation is by the vehicle's COMPLETED log-trip count that month — the same
 * set every P&L/finance screen aggregates. A vehicle with no completed trip in
 * the month has nothing to allocate onto (its fixed cost still shows in the
 * month total, it just isn't carried by any trip row). Each share is rounded to
 * whole đồng independently of row ordering, so a non-divisible total can drift
 * from the month figure by a few đồng — the month total stays authoritative.
 */
export interface TruckTripFixedShare {
  salary: number;
  depreciation: number;
  /** salary + depreciation */
  total: number;
  /** How many completed trips the month's fixed cost was split across. */
  tripCount: number;
}

const EMPTY_SHARE: TruckTripFixedShare = { salary: 0, depreciation: 0, total: 0, tripCount: 0 };

export interface TruckFixedAllocation {
  /** This trip's slice of its (vehicle, month) fixed cost; zeros when the trip
   * has no vehicle, or the vehicle has no salary/depreciation configured. */
  forTrip(month: string, vehicleId: string | null): TruckTripFixedShare;
}

const key = (month: string, vehicleId: string): string => `${month}|${vehicleId}`;

export async function loadTruckFixedAllocation(
  entId: string,
  months: string[],
): Promise<TruckFixedAllocation> {
  const shares = new Map<string, TruckTripFixedShare>();
  const uniqMonths = [...new Set(months)].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (uniqMonths.length === 0) return { forTrip: () => EMPTY_SHARE };

  const first = uniqMonths[0]!;
  const last = uniqMonths[uniqMonths.length - 1]!;
  const rangeStart = new Date(`${first}-01T00:00:00.000Z`);
  const lastStart = new Date(`${last}-01T00:00:00.000Z`);
  const rangeEnd = new Date(Date.UTC(lastStart.getUTCFullYear(), lastStart.getUTCMonth() + 1, 1));

  const [tripRows, fixedRows, vehicleRows] = await Promise.all([
    /* Completed log trips in the span — the allocation denominator. */
    db
      .select({ vehicleId: carTrips.trpVehicleId, scheduledAt: carTrips.trpScheduledAt })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, rangeStart),
          lt(carTrips.trpScheduledAt, rangeEnd),
        ),
      ),
    /* Manual per-(vehicle, month) fixed cost rows — these win. */
    db
      .select({
        vehicleId: carTruckFixedCosts.cvhId,
        month: carTruckFixedCosts.tfcMonth,
        salary: carTruckFixedCosts.tfcSalary,
        depreciation: carTruckFixedCosts.tfcDepreciation,
      })
      .from(carTruckFixedCosts)
      .where(and(eq(carTruckFixedCosts.entId, entId), inArray(carTruckFixedCosts.tfcMonth, uniqMonths))),
    /* Vehicle-level defaults (depreciation + default driver's fixed salary). */
    db
      .select({
        id: carVehicles.cvhId,
        depreciation: carVehicles.cvhDepreciation,
        driverId: carVehicles.cvhDefaultDriverId,
      })
      .from(carVehicles)
      .where(
        and(
          eq(carVehicles.entId, entId),
          eq(carVehicles.cvhType, 'TRUCK'),
          isNull(carVehicles.cvhDeletedAt),
        ),
      ),
  ]);

  const driverIds = [...new Set(vehicleRows.map((v) => v.driverId).filter((d): d is string => !!d))];
  const salaryByDriver = new Map<string, number>();
  if (driverIds.length > 0) {
    const drows = await db
      .select({ id: carDrivers.drvId, salary: carDrivers.drvFixedSalary })
      .from(carDrivers)
      .where(
        and(
          eq(carDrivers.entId, entId),
          inArray(carDrivers.drvId, driverIds),
          isNull(carDrivers.drvDeletedAt),
        ),
      );
    for (const d of drows) salaryByDriver.set(d.id, Math.round(parseAmount(d.salary)));
  }

  /* Completed-trip count per (month, vehicle). */
  const tripCount = new Map<string, number>();
  for (const t of tripRows) {
    if (!t.vehicleId) continue;
    const m = t.scheduledAt.toISOString().slice(0, 7);
    if (!uniqMonths.includes(m)) continue;
    const k = key(m, t.vehicleId);
    tripCount.set(k, (tripCount.get(k) ?? 0) + 1);
  }

  /* Monthly fixed cost per (month, vehicle) — manual row wins over the default. */
  const monthly = new Map<string, { salary: number; depreciation: number }>();
  for (const v of vehicleRows) {
    const dep = v.depreciation != null ? Math.round(parseAmount(v.depreciation)) : 0;
    const sal = v.driverId ? (salaryByDriver.get(v.driverId) ?? 0) : 0;
    if (dep === 0 && sal === 0) continue;
    for (const m of uniqMonths) monthly.set(key(m, v.id), { salary: sal, depreciation: dep });
  }
  for (const f of fixedRows) {
    monthly.set(key(f.month, f.vehicleId), {
      salary: Math.round(parseAmount(f.salary)),
      depreciation: Math.round(parseAmount(f.depreciation)),
    });
  }

  for (const [k, total] of monthly) {
    const n = tripCount.get(k) ?? 0;
    if (n <= 0) continue;
    const salary = Math.round(total.salary / n);
    const depreciation = Math.round(total.depreciation / n);
    shares.set(k, { salary, depreciation, total: salary + depreciation, tripCount: n });
  }

  return {
    forTrip(month, vehicleId) {
      if (!vehicleId) return EMPTY_SHARE;
      return shares.get(key(month, vehicleId)) ?? EMPTY_SHARE;
    },
  };
}
