import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckCostRates, carTruckFixedCosts, carVehicles } from '@car-v2/db/schema';
import { parseAmount } from './truck-cost';

/**
 * A truck's fixed cost FOR ONE MONTH — the single answer `computeTruckPnl`
 * builds its `fixedCost` aggregate on (salary/depreciation are never split
 * per trip, REQ-20260908 — same as maintenance).
 *
 * Precedence for (month, vehicle):
 *   1. `car_truck_fixed_costs` row for that exact (vehicle, month) — an explicit
 *      manual entry wins outright.
 *   2. Effective-dated rates (`car_truck_cost_rates`, migration 0025): the newest
 *      DEPRECIATION rate of the vehicle with `tcr_month <= month`, plus the newest
 *      SALARY rate of its default driver.
 *   3. Nothing effective yet → 0.
 *
 * Tier 2 replaces the old "read today's `cvh_depreciation` + `drv_fixed_salary`"
 * fallback, which had no time dimension: a month before the truck was bought
 * carried a full month of cost, and raising a salary rewrote every past month
 * (QA 2026-07-30).
 *
 * Known limit: the DRIVER whose salary is charged is the vehicle's CURRENT
 * default driver — reassignment history is not modelled. The salary AMOUNT is
 * historical; who was driving is not. Without a default driver the caller may
 * name the month's actual driver via `driverByKey` (see the opts).
 */
export interface MonthlyFixedCost {
  salary: number;
  depreciation: number;
  /** salary + depreciation */
  total: number;
}

const ZERO: MonthlyFixedCost = { salary: 0, depreciation: 0, total: 0 };

export interface TruckFixedMonthly {
  /** Truck ids the loader resolved (scope-filtered) — lets callers iterate. */
  vehicleIds: string[];
  forVehicleMonth(month: string, vehicleId: string | null): MonthlyFixedCost;
}

const key = (month: string, vehicleId: string): string => `${month}|${vehicleId}`;

export interface LoadTruckFixedMonthlyOpts {
  /** Restrict to one vehicle. */
  vehicleId?: string | null;
  /** Restrict to these vehicles (e.g. one region's trucks). */
  vehicleIds?: string[] | null;
  /**
   * `${month}|${vehicleId}` keys where the truck demonstrably RAN completed
   * trips (BUG-260930 case 4). Two consequences, both only for those keys:
   *  - a month BEFORE the first recorded rate borrows that first rate. Rates are
   *    stamped "effective from the month they were typed", so a tenant who sets
   *    up trucks/drivers today and then imports last quarter's log got 0 salary
   *    and 0 depreciation on every backfilled month — the report printed blank
   *    fixed costs for months the truck visibly worked. A month with NO trips
   *    still costs 0 (QA 2026-07-30: a month before the truck was bought must
   *    not carry a full month of cost).
   *  - `driverByKey` supplies the driver whose SALARY applies when the vehicle
   *    has no default driver — the report already names that driver on the
   *    vehicle row, so it must also charge them.
   */
  activeKeys?: ReadonlySet<string>;
  driverByKey?: ReadonlyMap<string, string>;
}

export async function loadTruckFixedMonthly(
  entId: string,
  months: string[],
  opts: LoadTruckFixedMonthlyOpts = {},
): Promise<TruckFixedMonthly> {
  const uniqMonths = [...new Set(months)].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (uniqMonths.length === 0) return { vehicleIds: [], forVehicleMonth: () => ZERO };
  const lastMonth = uniqMonths[uniqMonths.length - 1]!;

  const vehConds = [eq(carVehicles.entId, entId), eq(carVehicles.cvhType, 'TRUCK'), isNull(carVehicles.cvhDeletedAt)];
  if (opts.vehicleId) vehConds.push(eq(carVehicles.cvhId, opts.vehicleId));
  else if (opts.vehicleIds) {
    if (opts.vehicleIds.length === 0) return { vehicleIds: [], forVehicleMonth: () => ZERO };
    vehConds.push(inArray(carVehicles.cvhId, opts.vehicleIds));
  }

  const [vehicles, manual, rates] = await Promise.all([
    db
      .select({ id: carVehicles.cvhId, driverId: carVehicles.cvhDefaultDriverId })
      .from(carVehicles)
      .where(and(...vehConds)),
    db
      .select({
        vehicleId: carTruckFixedCosts.cvhId,
        month: carTruckFixedCosts.tfcMonth,
        salary: carTruckFixedCosts.tfcSalary,
        depreciation: carTruckFixedCosts.tfcDepreciation,
      })
      .from(carTruckFixedCosts)
      .where(and(eq(carTruckFixedCosts.entId, entId), inArray(carTruckFixedCosts.tfcMonth, uniqMonths))),
    /* Every rate effective at or before the LAST month asked for — the resolver
     * below walks them in month order and keeps the newest one that applies. */
    db
      .select({
        scope: carTruckCostRates.tcrScope,
        refId: carTruckCostRates.tcrRefId,
        kind: carTruckCostRates.tcrKind,
        month: carTruckCostRates.tcrMonth,
        amount: carTruckCostRates.tcrAmount,
      })
      .from(carTruckCostRates)
      .where(
        and(
          eq(carTruckCostRates.entId, entId),
          lte(carTruckCostRates.tcrMonth, lastMonth),
          isNull(carTruckCostRates.tcrDeletedAt),
        ),
      )
      .orderBy(asc(carTruckCostRates.tcrMonth)),
  ]);

  /* refId|kind → ascending [month, amount] pairs. */
  const timeline = new Map<string, { month: string; amount: number }[]>();
  for (const r of rates) {
    const k = `${r.refId}|${r.kind}`;
    const list = timeline.get(k) ?? [];
    list.push({ month: r.month, amount: Math.round(parseAmount(r.amount)) });
    timeline.set(k, list);
  }
  /** Rate in force during `month`. When the timeline starts LATER than `month`:
   * the first rate if the truck was active that month (`backfill`), else 0. */
  const rateAt = (
    refId: string | null,
    kind: 'DEPRECIATION' | 'SALARY',
    month: string,
    backfill: boolean,
  ): number => {
    if (!refId) return 0;
    const list = timeline.get(`${refId}|${kind}`);
    if (!list || list.length === 0) return 0;
    if (list[0]!.month > month) return backfill ? list[0]!.amount : 0;
    let amount = 0;
    for (const r of list) {
      if (r.month > month) break; // sorted ascending
      amount = r.amount;
    }
    return amount;
  };

  const resolved = new Map<string, MonthlyFixedCost>();
  for (const v of vehicles) {
    for (const m of uniqMonths) {
      const k = key(m, v.id);
      const active = opts.activeKeys?.has(k) ?? false;
      const driverId = v.driverId ?? opts.driverByKey?.get(k) ?? null;
      const depreciation = rateAt(v.id, 'DEPRECIATION', m, active);
      const salary = rateAt(driverId, 'SALARY', m, active);
      if (depreciation === 0 && salary === 0) continue;
      resolved.set(key(m, v.id), { salary, depreciation, total: salary + depreciation });
    }
  }
  /* Manual entry wins — including an explicit 0 for a month someone zeroed out. */
  const inScope = new Set(vehicles.map((v) => v.id));
  for (const f of manual) {
    if (!inScope.has(f.vehicleId)) continue;
    const salary = Math.round(parseAmount(f.salary));
    const depreciation = Math.round(parseAmount(f.depreciation));
    resolved.set(key(f.month, f.vehicleId), { salary, depreciation, total: salary + depreciation });
  }

  return {
    vehicleIds: vehicles.map((v) => v.id),
    forVehicleMonth(month, vehicleId) {
      if (!vehicleId) return ZERO;
      return resolved.get(key(month, vehicleId)) ?? ZERO;
    },
  };
}
