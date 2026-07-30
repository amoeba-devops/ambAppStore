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
  /** Restrict to vehicles in this operating region (cvh_region code). Like the
   * vehicle filter, this excludes fleet-level driver salary (not region-tied). */
  region?: string | null;
  /** Months to report, 'YYYY-MM'. */
  months: string[];
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
   * trips + fixed costs to them. No trucks in the region → all-zero rows. */
  let regionVehicleIds: string[] | null = null;
  if (q.region) {
    const vrows = await db
      .select({ id: carVehicles.cvhId })
      .from(carVehicles)
      .where(
        and(
          eq(carVehicles.entId, actor.entId),
          eq(carVehicles.cvhType, 'TRUCK'),
          eq(carVehicles.cvhRegion, q.region),
          isNull(carVehicles.cvhDeletedAt),
        ),
      );
    regionVehicleIds = vrows.map((r) => r.id);
    if (regionVehicleIds.length === 0) return months.map((m) => emptyRow(m));
  }
  const vehicleFilter = (col: typeof carTrips.trpVehicleId | typeof carTruckFixedCosts.cvhId) =>
    q.vehicleId ? eq(col, q.vehicleId) : regionVehicleIds ? inArray(col, regionVehicleIds) : undefined;

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

  const fixed = await db
    .select()
    .from(carTruckFixedCosts)
    .where(
      and(
        eq(carTruckFixedCosts.entId, actor.entId),
        inArray(carTruckFixedCosts.tfcMonth, months),
        vehicleFilter(carTruckFixedCosts.cvhId),
      ),
    );

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

  for (const f of fixed) {
    const row = rows.get(f.tfcMonth);
    if (!row) continue;
    row.salary += Math.round(parseAmount(f.tfcSalary));
    row.depreciation += Math.round(parseAmount(f.tfcDepreciation));
    row.insurance += Math.round(parseAmount(f.tfcInsurance));
  }

  /* Vehicle-level fixed-cost defaults (QA 2026-07 "1 xe ↔ 1 tài xế", extended
   * to the fleet aggregate 2026-07-21): every truck in scope WITHOUT a manual
   * car_truck_fixed_costs row for a month falls back to its own depreciation +
   * its default driver's fixed salary (folded into `salary`). Applied to ALL
   * views — per-vehicle, per-region, AND all-trucks — so the fleet total = Σ
   * per-vehicle = the per-region breakdown = the monthly report. (Previously
   * the all-trucks view skipped this and instead summed a fleet-wide roster
   * driver salary, which omitted depreciation and disagreed with the report;
   * that path is removed. `driverSalary` stays for the P&L row shape but is
   * always 0 now — driver salary lives in `salary`.) */
  const vdefConds = [
    eq(carVehicles.entId, actor.entId),
    eq(carVehicles.cvhType, 'TRUCK'),
    isNull(carVehicles.cvhDeletedAt),
  ];
  if (q.vehicleId) vdefConds.push(eq(carVehicles.cvhId, q.vehicleId));
  else if (regionVehicleIds) vdefConds.push(inArray(carVehicles.cvhId, regionVehicleIds));
  const vdefs = await db
    .select({ id: carVehicles.cvhId, dep: carVehicles.cvhDepreciation, drv: carVehicles.cvhDefaultDriverId })
    .from(carVehicles)
    .where(and(...vdefConds));
  const drvIds = [...new Set(vdefs.map((v) => v.drv).filter((x): x is string => !!x))];
  const salByDrv = new Map<string, number>();
  if (drvIds.length) {
    const drows = await db
      .select({ id: carDrivers.drvId, sal: carDrivers.drvFixedSalary })
      .from(carDrivers)
      .where(
        and(
          eq(carDrivers.entId, actor.entId),
          inArray(carDrivers.drvId, drvIds),
          isNull(carDrivers.drvDeletedAt),
        ),
      );
    for (const d of drows) salByDrv.set(d.id, Math.round(parseAmount(d.sal)));
  }
  const tfcSeen = new Set(fixed.map((f) => `${f.cvhId}|${f.tfcMonth}`));
  for (const v of vdefs) {
    const dep = v.dep != null ? Math.round(parseAmount(v.dep)) : 0;
    const sal = v.drv ? (salByDrv.get(v.drv) ?? 0) : 0;
    if (dep === 0 && sal === 0) continue;
    for (const m of months) {
      if (tfcSeen.has(`${v.id}|${m}`)) continue; // a manual fixed-cost row wins
      const row = rows.get(m);
      if (!row) continue;
      row.depreciation += dep;
      row.salary += sal;
    }
  }

  for (const row of rows.values()) {
    row.variableCost = row.fuelCost + row.tollFee + row.extraTotal;
    /* Insurance removed from the fixed-cost model (2026-07-21) — field kept on
     * the row (=0) for the report export shape, but no longer summed or shown. */
    row.fixedCost = row.salary + row.depreciation;
    row.netProfit = row.revenue - row.variableCost - row.fixedCost;
  }

  return months.map((m) => rows.get(m)!);
}
