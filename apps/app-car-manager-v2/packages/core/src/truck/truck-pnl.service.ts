import { and, eq, gte, lt, isNull, inArray } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carTripExtraCosts,
  carTruckFixedCosts,
  carDrivers,
  carVehicles,
} from '@car-v2/db/schema';
import type { FleetActor } from '../types';
import { parseAmount } from './truck-cost';
import { loadTruckFixedMonthly } from './truck-fixed-monthly';
import { loadTruckRegionSnapshots } from './truck-fuel-snapshot';

/**
 * Monthly P&L per truck (REQ-20260617, customer SRS §2.3):
 *   net profit = revenue − variable (fuel + toll + extra) − fixed (salary +
 *   depreciation + insurance). Variable costs auto-aggregate from COMPLETED
 *   LOG trips; fixed costs come from car_truck_fixed_costs.
 *
 * Small dataset (a handful of trucks) → aggregate in JS for clarity. Month
 * bucketing uses the trip's scheduled date in UTC ('YYYY-MM').
 */

export interface TruckPnlRow {
  month: string;
  revenue: number;
  fuelCost: number;
  tollFee: number;
  extraTotal: number;
  variableCost: number;
  salary: number;
  depreciation: number;
  insurance: number;
  /** @deprecated Always 0 since 2026-07-21. Driver salary now folds into
   * `salary` (per-vehicle default-driver salary) in every view; kept only for
   * the stored P&L row shape. */
  driverSalary: number;
  fixedCost: number;
  tripCount: number;
  netProfit: number;
  /** Per-fuel-mode trip counts within this row (REQ-20260724) → drives the
   * aggregate fuel badge (all-same mode → that badge; blend → "Hỗn hợp"):
   *  - averaged: fuel = frozen month-end reconciliation (invoices)
   *  - live: fuel = km × (chi phí nhiên liệu tháng của xe ÷ km tháng), tạm tính
   *  - unset: vehicle has no quota/price → fuel counted as 0 */
  fuelAveragedTripCount: number;
  fuelLiveTripCount: number;
  fuelUnsetTripCount: number;
}

export interface TruckPnlQuery {
  vehicleId?: string | null;
  /**
   * Restrict to this set of trucks — the multi-select vehicle filter
   * (REQ-20260814). Unlike `vehicleId`, this INTERSECTS `region`/`regions`
   * rather than replacing them, so an id outside the actor's region scope can
   * never widen the result. Undefined/empty = no vehicle filter.
   *
   * Like the other vehicle-level filters, this excludes fleet-level driver
   * salary (not tied to any one truck).
   */
  vehicleIds?: readonly string[] | null;
  /** Restrict to vehicles in this operating region (cvh_region code). Like the
   * vehicle filter, this excludes fleet-level driver salary (not region-tied). */
  region?: string | null;
  /**
   * Restrict to vehicles in ANY of these regions — the region-ACL scope for a
   * user narrowed to a subset (REQ-20260813). Ignored when `region` is set,
   * which is already the narrower filter.
   */
  regions?: readonly string[] | null;
  /** Months to report, 'YYYY-MM'. */
  months: string[];
  /**
   * Allocate the month's fixed cost even when the queried scope logged NO
   * completed trip that month.
   *
   * Default false (QA 2026-07-30: "tháng không có chuyến thì không phân bổ chi
   * phí cố định"). Salary + depreciation come from a monthly source, so a scope
   * with nothing driven used to report the whole month's fixed cost as a pure
   * loss — a freshly reset month read as −14,5tr with zero activity, and every
   * future month reads the same way because the vehicle-level fallback is not
   * date-bounded.
   *
   * The per-vehicle report sheet passes true on purpose: its IDLE rows exist
   * precisely to show what a truck cost while it sat still.
   */
  fixedCostWithoutTrips?: boolean;
}

function emptyRow(month: string): TruckPnlRow {
  return {
    month,
    revenue: 0,
    fuelCost: 0,
    tollFee: 0,
    extraTotal: 0,
    variableCost: 0,
    salary: 0,
    depreciation: 0,
    insurance: 0,
    driverSalary: 0,
    fixedCost: 0,
    tripCount: 0,
    netProfit: 0,
    fuelAveragedTripCount: 0,
    fuelLiveTripCount: 0,
    fuelUnsetTripCount: 0,
  };
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function monthEndExclusive(month: string): Date {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

export async function computeTruckPnl(actor: FleetActor, q: TruckPnlQuery): Promise<TruckPnlRow[]> {
  const months = [...new Set(q.months)].sort();
  if (months.length === 0) return [];

  const firstMonth = months[0]!;
  const lastMonth = months[months.length - 1]!;
  const rangeStart = new Date(`${firstMonth}-01T00:00:00.000Z`);
  const rangeEnd = monthEndExclusive(lastMonth);

  /* Region filter (REQ-20260630): resolve the trucks in the region, then scope
   * trips + fixed costs to them. No trucks in the region → all-zero rows.
   * `regions` (REQ-20260813) is the same mechanism over a set of regions. */
  let regionVehicleIds: string[] | null = null;
  /* An empty `regions` means "no region permitted" — never widen it to no filter. */
  if (!q.region && q.regions && q.regions.length === 0) return months.map((m) => emptyRow(m));
  const regionScope = q.region
    ? eq(carVehicles.cvhRegion, q.region)
    : q.regions
      ? inArray(carVehicles.cvhRegion, [...q.regions])
      : null;
  if (regionScope) {
    const vrows = await db
      .select({ id: carVehicles.cvhId })
      .from(carVehicles)
      .where(
        and(
          eq(carVehicles.entId, actor.entId),
          eq(carVehicles.cvhType, 'TRUCK'),
          regionScope,
          isNull(carVehicles.cvhDeletedAt),
        ),
      );
    regionVehicleIds = vrows.map((r) => r.id);
    if (regionVehicleIds.length === 0) return months.map((m) => emptyRow(m));
  }
  /* Multi-select vehicle scope (REQ-20260814) INTERSECTS the region scope — it
   * never widens it. `vehicleId` keeps its historical "replaces" semantics
   * because every caller already validates it against a region-scoped list;
   * the new array path must not inherit that, since it also serves the export
   * route handlers, which bypass the /truck layout guard. */
  const scopedVehicleIds: string[] | null = q.vehicleIds?.length
    ? regionVehicleIds
      ? q.vehicleIds.filter((v) => regionVehicleIds!.includes(v))
      : [...q.vehicleIds]
    : regionVehicleIds;
  /* Asked for specific trucks, none of them in scope → nothing to report. */
  if (q.vehicleIds?.length && scopedVehicleIds!.length === 0) return months.map((m) => emptyRow(m));

  const vehicleFilter = (col: typeof carTrips.trpVehicleId | typeof carTruckFixedCosts.cvhId) =>
    q.vehicleId
      ? eq(col, q.vehicleId)
      : scopedVehicleIds
        ? inArray(col, scopedVehicleIds)
        : undefined;

  const trips = await db
    .select({
      trpId: carTrips.trpId,
      vehicleId: carTrips.trpVehicleId,
      scheduledAt: carTrips.trpScheduledAt,
      fuelLiters: carTrips.trpFuelLiters,
      fuelPrice: carTrips.trpFuelPrice,
      startOdometer: carTrips.trpStartOdometer,
      endOdometer: carTrips.trpEndOdometer,
      tollFee: carTrips.trpTollFee,
      revenue: carTrips.trpRevenue,
    })
    .from(carTrips)
    .where(
      and(
        eq(carTrips.entId, actor.entId),
        eq(carTrips.trpKind, 'LOG'),
        eq(carTrips.trpStatus, 'COMPLETED'),
        isNull(carTrips.trpDeletedAt),
        gte(carTrips.trpScheduledAt, rangeStart),
        lt(carTrips.trpScheduledAt, rangeEnd),
        vehicleFilter(carTrips.trpVehicleId),
      ),
    );

  const tripIds = trips.map((t) => t.trpId);
  const extras = tripIds.length
    ? await db
        .select({ trpId: carTripExtraCosts.trpId, amount: carTripExtraCosts.tecAmount })
        .from(carTripExtraCosts)
        .where(
          and(
            eq(carTripExtraCosts.entId, actor.entId),
            inArray(carTripExtraCosts.trpId, tripIds),
          ),
        )
    : [];
  const extraByTrip = new Map<string, number>();
  for (const e of extras) {
    extraByTrip.set(e.trpId, (extraByTrip.get(e.trpId) ?? 0) + parseAmount(e.amount));
  }

  /* Region-scoped month-end fuel snapshot (REQ-20260630). The close is per
   * (ent, TRUCK, month, region); each trip's official fuel cost uses ITS
   * region's snapshot (region = its vehicle's cvh_region). A (month, region)
   * with a live close + non-null snapshot → km × consumption × avg price;
   * otherwise the trip's own liters × price (fallback below). */
  const snapshots = await loadTruckRegionSnapshots(actor.entId, months);

  const rows = new Map<string, TruckPnlRow>();
  for (const m of months) rows.set(m, emptyRow(m));

  for (const t of trips) {
    const mk = monthKey(t.scheduledAt);
    const row = rows.get(mk);
    if (!row) continue;
    row.revenue += Math.round(parseAmount(t.revenue));
    const km =
      t.startOdometer != null && t.endOdometer != null ? t.endOdometer - t.startOdometer : 0;
    /* Fuel = frozen snapshot → vehicle rate → 0 (REQ-20260724), same precedence
     * everywhere via the shared helper. */
    const fuel = snapshots.fuelForTrip(mk, t.vehicleId, km);
    row.fuelCost += fuel.cost;
    if (fuel.mode === 'AVERAGED') row.fuelAveragedTripCount += 1;
    else if (fuel.mode === 'LIVE') row.fuelLiveTripCount += 1;
    else row.fuelUnsetTripCount += 1;
    row.tollFee += Math.round(parseAmount(t.tollFee));
    row.extraTotal += Math.round(extraByTrip.get(t.trpId) ?? 0);
    row.tripCount += 1;
  }

  /* Monthly fixed cost per (month, truck) from the shared resolver: manual
   * car_truck_fixed_costs row → effective-dated rate history (migration 0025) →
   * 0. Historical months therefore keep the rate that was in force THEN, and a
   * month before the truck existed carries nothing (QA 2026-07-30). */
  const fixedMonthly = await loadTruckFixedMonthly(actor.entId, months, {
    vehicleId: q.vehicleId ?? null,
    vehicleIds: q.vehicleId ? null : scopedVehicleIds,
  });
  for (const vid of fixedMonthly.vehicleIds) {
    for (const m of months) {
      const row = rows.get(m);
      if (!row) continue;
      const fc = fixedMonthly.forVehicleMonth(m, vid);
      row.salary += fc.salary;
      row.depreciation += fc.depreciation;
    }
  }

  for (const row of rows.values()) {
    row.variableCost = row.fuelCost + row.tollFee + row.extraTotal;
    /* No trip → nothing to allocate the month's fixed cost onto (see
     * `fixedCostWithoutTrips`). Zeroed here, after both the manual rows and the
     * vehicle-level fallback have been summed, so neither source leaks through. */
    if (row.tripCount === 0 && !q.fixedCostWithoutTrips) {
      row.salary = 0;
      row.driverSalary = 0;
      row.depreciation = 0;
      row.insurance = 0;
    }
    /* Insurance removed from the fixed-cost model (2026-07-21) — field kept on
     * the row (=0) for the report export shape, but no longer summed or shown. */
    row.fixedCost = row.salary + row.depreciation;
    row.netProfit = row.revenue - row.variableCost - row.fixedCost;
  }

  return months.map((m) => rows.get(m)!);
}
