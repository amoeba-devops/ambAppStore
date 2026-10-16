import { and, asc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips, carTruckCostRates, carTruckFixedCosts, carVehicles } from '@car-v2/db/schema';
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
 * SALARY is a cost of the PERSON, not of a truck: each driver's monthly salary
 * is charged exactly ONCE per month and split across the trucks they drove that
 * month in proportion to their completed trips (`allocateSalary`). So the fleet
 * total equals what was really paid, never depends on who drove first, and a
 * driver who covers two trucks is not billed twice. A driver with no trips that
 * month falls back to being charged on their default truck(s) — an idle truck
 * still shows its own driver's cost. (Reassignment history is not modelled;
 * the salary AMOUNT is historical, the default-truck link is current.)
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
   * trips (BUG-260930 case 4). Only for those keys, a month BEFORE the first recorded rate borrows that first rate. Rates are
   *    stamped "effective from the month they were typed", so a tenant who sets
   * up trucks/drivers today and then imports last quarter's log got 0 salary
   * and 0 depreciation on every backfilled month — the report printed blank
   * fixed costs for months the truck visibly worked. A month with NO trips
   * still costs 0 (QA 2026-07-30: a month before the truck was bought must
   * not carry a full month of cost). A driver who drove that month is always
   * treated as active (the trips prove it).
   */
  activeKeys?: ReadonlySet<string>;
}

/**
 * Split ONE driver's monthly salary across the trucks they drove, proportional to
 * trips. Integer amounts that always sum back to `salary` exactly: the rounding
 * remainder goes to the truck with the most trips (ties → lowest vehicle id), so
 * the result never depends on iteration order.
 */
export function allocateSalary(salary: number, tripsByVehicle: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const entries = [...tripsByVehicle].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (salary === 0 || total === 0) return out;
  let given = 0;
  for (const [vid, n] of entries) {
    const part = Math.floor((salary * n) / total);
    out.set(vid, part);
    given += part;
  }
  const [top] = entries[0]!;
  out.set(top, out.get(top)! + (salary - given));
  return out;
}

export async function loadTruckFixedMonthly(
  entId: string,
  months: string[],
  opts: LoadTruckFixedMonthlyOpts = {},
): Promise<TruckFixedMonthly> {
  const uniqMonths = [...new Set(months)].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (uniqMonths.length === 0) return { vehicleIds: [], forVehicleMonth: () => ZERO };
  const lastMonth = uniqMonths[uniqMonths.length - 1]!;

  if (!opts.vehicleId && opts.vehicleIds && opts.vehicleIds.length === 0) {
    return { vehicleIds: [], forVehicleMonth: () => ZERO };
  }
  const rangeStart = new Date(`${uniqMonths[0]}-01T00:00:00.000Z`);
  const [ly = 0, lm = 0] = lastMonth.split('-').map(Number);
  const rangeEnd = new Date(Date.UTC(ly, lm, 1));
  const tripMonth = sql<string>`to_char(${carTrips.trpScheduledAt} at time zone 'UTC', 'YYYY-MM')`;

  const [allTrucks, manual, rates, driven, firstTrips] = await Promise.all([
    /* EVERY truck of the tenant, scoped in memory below: a driver's salary is
     * split across all trucks they drove, so a region/vehicle-filtered report
     * must still see the trips on the trucks outside its scope. */
    db
      .select({ id: carVehicles.cvhId, driverId: carVehicles.cvhDefaultDriverId })
      .from(carVehicles)
      .where(and(eq(carVehicles.entId, entId), eq(carVehicles.cvhType, 'TRUCK'), isNull(carVehicles.cvhDeletedAt))),
    db
      .select({
        vehicleId: carTruckFixedCosts.cvhId,
        month: carTruckFixedCosts.tfcMonth,
        salary: carTruckFixedCosts.tfcSalary,
        depreciation: carTruckFixedCosts.tfcDepreciation,
      })
      .from(carTruckFixedCosts)
      .where(and(eq(carTruckFixedCosts.entId, entId), inArray(carTruckFixedCosts.tfcMonth, uniqMonths))),
    /* EVERY live rate of the tenant — deliberately NOT capped at the last month
     * asked for. The backfill rule (`rateAt`) borrows the FIRST rate for a month
     * before it, and that first rate usually sits AFTER the requested month (rates
     * are stamped with the month they were typed, e.g. 2026-09, while the report
     * is for 2026-08). A `tcr_month <= lastMonth` cap hid it → blank salary and
     * depreciation (FIX-261016). The table is a few rows per truck/driver. */
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
          isNull(carTruckCostRates.tcrDeletedAt),
        ),
      )
      .orderBy(asc(carTruckCostRates.tcrMonth)),
    /* Who drove which truck how often, per month — same trip filter as
     * computeTruckPnl (completed, live LOG trips). */
    db
      .select({
        month: tripMonth,
        vehicleId: carTrips.trpVehicleId,
        driverId: carTrips.trpDriverId,
        n: sql<number>`count(*)::int`,
      })
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
      )
      .groupBy(tripMonth, carTrips.trpVehicleId, carTrips.trpDriverId),
    /* Month of each truck's FIRST completed trip, all-time (not limited to the
     * requested months) — its "in service since" marker. */
    db
      .select({
        vehicleId: carTrips.trpVehicleId,
        month: sql<string>`to_char(min(${carTrips.trpScheduledAt}) at time zone 'UTC', 'YYYY-MM')`,
      })
      .from(carTrips)
      .where(
        and(
          eq(carTrips.entId, entId),
          eq(carTrips.trpKind, 'LOG'),
          eq(carTrips.trpStatus, 'COMPLETED'),
          isNull(carTrips.trpDeletedAt),
        ),
      )
      .groupBy(carTrips.trpVehicleId),
  ]);

  const scopeIds = opts.vehicleId ? new Set([opts.vehicleId]) : opts.vehicleIds ? new Set(opts.vehicleIds) : null;
  const liveTruckIds = new Set(allTrucks.map((v) => v.id));
  const firstTripMonth = new Map<string, string>();
  for (const f of firstTrips) if (f.vehicleId && f.month) firstTripMonth.set(f.vehicleId, f.month);
  /* In service in `month` = the truck ran a completed trip that month (activeKeys)
   * OR it has already been working since an earlier month. Keeps the backfill
   * consistent across months: a month the truck merely sat idle after its first
   * trip is costed exactly like a busy one, instead of reading 0 before the first
   * rate and a full cost after it. Months BEFORE the first trip stay 0 — the truck
   * was not bought yet (QA 2026-07-30). */
  const inService = (vehicleId: string, month: string): boolean =>
    (opts.activeKeys?.has(key(month, vehicleId)) ?? false) ||
    (firstTripMonth.get(vehicleId) ?? '9999-99') <= month;
  const vehicles = scopeIds ? allTrucks.filter((v) => scopeIds.has(v.id)) : allTrucks;

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

  /* Salary, once per (driver, month): split across the trucks the driver drove
   * (trips as weights); a driver with no trips that month sits on their default
   * truck(s) instead, active only if that truck ran (backfill rule above). */
  const tripsByDriverMonth = new Map<string, Map<string, number>>(); // `${driver}|${month}` → vehicle → trips
  for (const d of driven) {
    /* Soft-deleted trucks are dropped from the split so the driver's salary is
     * never lost on a truck no report can show. */
    if (!d.driverId || !d.vehicleId || !liveTruckIds.has(d.vehicleId)) continue;
    const k = `${d.driverId}|${d.month}`;
    const m = tripsByDriverMonth.get(k) ?? new Map<string, number>();
    m.set(d.vehicleId, (m.get(d.vehicleId) ?? 0) + d.n);
    tripsByDriverMonth.set(k, m);
  }
  const defaultTrucksOf = new Map<string, string[]>(); // driver → trucks they are default for
  for (const v of allTrucks) {
    if (!v.driverId) continue;
    defaultTrucksOf.set(v.driverId, [...(defaultTrucksOf.get(v.driverId) ?? []), v.id]);
  }
  const driverIds = new Set<string>(defaultTrucksOf.keys());
  for (const k of tripsByDriverMonth.keys()) driverIds.add(k.split('|')[0]!);
  const salaryByKey = new Map<string, number>(); // `${month}|${vehicleId}`
  for (const m of uniqMonths) {
    for (const driverId of driverIds) {
      const trips = tripsByDriverMonth.get(`${driverId}|${m}`);
      let shares: ReadonlyMap<string, number>;
      let amount: number;
      if (trips) {
        shares = trips;
        amount = rateAt(driverId, 'SALARY', m, true);
      } else {
        const trucks = defaultTrucksOf.get(driverId) ?? [];
        shares = new Map(trucks.map((id) => [id, 1]));
        amount = rateAt(driverId, 'SALARY', m, trucks.some((id) => inService(id, m)));
      }
      for (const [vid, part] of allocateSalary(amount, shares)) {
        salaryByKey.set(key(m, vid), (salaryByKey.get(key(m, vid)) ?? 0) + part);
      }
    }
  }

  const resolved = new Map<string, MonthlyFixedCost>();
  for (const v of vehicles) {
    for (const m of uniqMonths) {
      const k = key(m, v.id);
      const depreciation = rateAt(v.id, 'DEPRECIATION', m, inService(v.id, m));
      const salary = salaryByKey.get(k) ?? 0;
      if (depreciation === 0 && salary === 0) continue;
      resolved.set(k, { salary, depreciation, total: salary + depreciation });
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
