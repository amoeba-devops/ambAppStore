import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carVehicles, type TruckReportFixedAlloc } from '@car-v2/db/schema';
import { loadTruckFixedMonthly } from './truck-fixed-monthly';

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

  const [tripRows, fixedMonthly] = await Promise.all([
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
    /* The month's fixed cost per truck — SAME resolver `computeTruckPnl` uses
     * (manual row → effective-dated rate history → 0), so Σ(shares) reconciles
     * with the month total instead of re-deriving it here. */
    loadTruckFixedMonthly(entId, uniqMonths),
  ]);

  /* Completed-trip count per (month, vehicle). */
  const tripCount = new Map<string, number>();
  for (const t of tripRows) {
    if (!t.vehicleId) continue;
    const m = t.scheduledAt.toISOString().slice(0, 7);
    if (!uniqMonths.includes(m)) continue;
    const k = key(m, t.vehicleId);
    tripCount.set(k, (tripCount.get(k) ?? 0) + 1);
  }

  /* Monthly fixed cost per (month, vehicle), resolved above. */
  const monthly = new Map<string, { salary: number; depreciation: number }>();
  for (const vid of fixedMonthly.vehicleIds) {
    for (const m of uniqMonths) {
      const fc = fixedMonthly.forVehicleMonth(m, vid);
      if (fc.total === 0) continue;
      monthly.set(key(m, vid), { salary: fc.salary, depreciation: fc.depreciation });
    }
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

/**
 * The month's fixed-cost allocation basis per vehicle — what "Lập báo cáo"
 * FREEZES onto the report row (`trr_fixed_alloc`, REQ-20260821, same idea as
 * `trr_vehicle_fuel`). Per-trip shares must stop moving once a report showed
 * them: readers take `salary ÷ tripCount` from the latest covering report and
 * only fall back to the live `loadTruckFixedAllocation` when no report covers
 * the trip.
 *
 * Basis + denominator are stored (not the rounded share) so the reader divides
 * with the SAME Math.round as the live path — frozen and live can only differ
 * by data recorded after the report, never by arithmetic.
 *
 * Scope mirrors the report's own: a subset report freezes only its vehicles, a
 * whole-region one every truck of the region, region null = every truck. All
 * resolved vehicles are stored — including tripCount 0 and zero-cost ones — so
 * the row states exactly which vehicles the generation covered.
 */
export async function computeTruckFixedAllocRows(
  entId: string,
  month: string,
  opts: { region?: string | null; vehicleIds?: string[] | null } = {},
): Promise<TruckReportFixedAlloc[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];

  const vehConds = [
    eq(carVehicles.entId, entId),
    eq(carVehicles.cvhType, 'TRUCK'),
    isNull(carVehicles.cvhDeletedAt),
  ];
  /* A subset report's ids are already region-validated by the caller
   * (resolveReportVehicleScope) — they take precedence over `region`. */
  if (opts.vehicleIds?.length) vehConds.push(inArray(carVehicles.cvhId, opts.vehicleIds));
  else if (opts.region) vehConds.push(eq(carVehicles.cvhRegion, opts.region));
  const vehicles = await db
    .select({ id: carVehicles.cvhId })
    .from(carVehicles)
    .where(and(...vehConds));
  if (vehicles.length === 0) return [];
  const ids = vehicles.map((v) => v.id);

  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const [tripRows, fixedMonthly] = await Promise.all([
    /* Same denominator set as loadTruckFixedAllocation: COMPLETED log trips. */
    db
      .select({ vehicleId: carTrips.trpVehicleId })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
          gte(carTrips.trpScheduledAt, start),
          lt(carTrips.trpScheduledAt, end),
          inArray(carTrips.trpVehicleId, ids),
        ),
      ),
    /* Same monthly source as computeTruckPnl → the frozen shares reconcile
     * with the month's fixedCost the report itself printed. */
    loadTruckFixedMonthly(entId, [month], { vehicleIds: ids }),
  ]);

  const counts = new Map<string, number>();
  for (const t of tripRows) {
    if (t.vehicleId) counts.set(t.vehicleId, (counts.get(t.vehicleId) ?? 0) + 1);
  }
  return ids.map((id) => {
    const fc = fixedMonthly.forVehicleMonth(month, id);
    return {
      vehicleId: id,
      salary: fc.salary,
      depreciation: fc.depreciation,
      tripCount: counts.get(id) ?? 0,
    };
  });
}
