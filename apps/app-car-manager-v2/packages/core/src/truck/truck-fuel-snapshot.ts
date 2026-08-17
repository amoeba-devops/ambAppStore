import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMonthClose, carTruckReports, carVehicles } from '@car-v2/db/schema';
import { parseAmount, truckTripFuelCost } from './truck-cost';
import { fuelPoolKey, loadVehicleFuelPool, type VehicleFuelPool } from './truck-fuel-pool';

/**
 * Region-scoped month-end fuel snapshot (REQ-20260630, report-based since
 * PLAN-20260707). Every "Lập báo cáo" run RECOMPUTES the reconciliation (avg
 * invoice price + consumption) and freezes it onto the report row; the LATEST
 * live report per (ent, month, region) is the official snapshot. Legacy
 * car_truck_month_close rows (the removed manual chốt sổ) remain as fallback so
 * historical closed months keep their numbers.
 *
 * TWO distinct concepts (decoupled 2026-07-21, BUG-260721):
 *  - `isReported(month, vehicle)` — a report EXISTS for the trip's (month,
 *    region) (or a consolidated "all regions" report covers it). Drives the
 *    "Đã lập BC" vs "Tạm tính" status. Generating a report finalizes the trip
 *    even when there are no fuel invoices to reconcile against.
 *  - `forTrip(month, vehicle)` — the frozen fuel snapshot for that (month,
 *    region), or null. Drives the fuel COST: when present, km × consumption ×
 *    avg price; when null (report exists but no invoices, or no report), the
 *    LIVE per-vehicle pool takes over. So "finalized" no longer implies a
 *    snapshot.
 *
 * Fuel is allocated from what the vehicle ACTUALLY spent (QA 2026-07-30):
 * `km × (vehicle's monthly fuel spend ÷ its monthly km)`, live before a report
 * and frozen after one. The vehicle's định mức (quota × price) is NOT part of
 * any cost path — the old VEHICLE_RATE estimate it produced disagreed with the
 * money the report would later freeze, which is what made the pre-report figure
 * wrong.
 *
 * `loadTruckRegionSnapshots` batches the lookups every fuel-computing site
 * needs (P&L, trip list, finance list, exports) so the rule stays identical
 * across them.
 */
export interface RegionSnapshot {
  avgPrice: number;
  consumption: number;
}

/**
 * A vehicle's frozen monthly fuel reconciliation (REQ-20260726): its OWN fuel
 * spend for the month, spread over its trips by km. `costPerKm = money ÷ km`,
 * so `Σ over the vehicle's trips (km × costPerKm) = money` — the allocation
 * reconciles exactly to what that vehicle actually spent on fuel.
 */
export interface VehicleFuelSnapshot {
  costPerKm: number;
  /** Mean invoice unit price (đ/L) — shown as the trip's "Đơn giá". */
  avgPrice: number;
  /** Litres ÷ km — shown as the trip's "Lít" (km × consumption). */
  consumption: number;
}

/** How a trip's fuel cost was derived (drives the badge + toast copy):
 *  - AVERAGED → frozen month-end reconciliation. Since REQ-20260726 this is
 *    preferably the VEHICLE's own spend spread over its trips by km
 *    (`km × costPerKm`); legacy reports fall back to the region pool
 *    (`km × consumption × avgPrice`).
 *  - LIVE     → the same per-vehicle allocation computed from what is recorded
 *    RIGHT NOW (fuel invoices + fuel entered on the month's trips), i.e. a
 *    provisional figure that still moves until the report freezes it.
 *  - UNSET    → the vehicle has no fuel spend recorded for the month → cost 0. */
export type TruckFuelMode = 'AVERAGED' | 'LIVE' | 'UNSET';

export interface TruckTripFuel {
  cost: number;
  /** Unit price shown (đ/L): avg price (averaged) or vehicle price (rate); 0 when unset. */
  unitPrice: number;
  /** Litres shown: km × consumption; 0 when unset. */
  liters: number;
  /** Cost of ONE km for this trip (đ/km) = consumption × unitPrice. Lets the UI
   * explain the figure per-trip as `{km} km × {costPerKm} ₫/km = {cost}` — the
   * same shape in both modes, and it makes plain that km drives the cost
   * (REQ-20260724 UX). 0 when unset. */
  costPerKm: number;
  mode: TruckFuelMode;
}

const snapKey = (month: string, region: string): string => `${month}|${region}`;

export interface TruckRegionSnapshots {
  /** Keyed `${month}|${region}` — only present when that region's month has a
   * computable fuel snapshot (invoices → avg price + consumption). region '' =
   * a consolidated "all regions" / legacy whole-fleet snapshot. */
  snap: Map<string, RegionSnapshot>;
  /** Keyed `${month}|${vehicleId}` — the vehicle's OWN frozen reconciliation
   * (REQ-20260726). Takes precedence over the region pool. */
  vehicleSnap: Map<string, VehicleFuelSnapshot>;
  /** vehicleId → region code ('' when the vehicle has no region). */
  vehicleRegion: Map<string, string>;
  /** Keyed `${month}|${vehicleId}` — the LIVE pool (what is recorded now).
   * Used when nothing is frozen yet; also what the report will freeze. */
  livePool: Map<string, VehicleFuelPool>;
  /** Look up the frozen fuel snapshot for a trip (null → use vehicle rate). */
  forTrip(month: string, vehicleId: string | null): RegionSnapshot | null;
  /** Keyed `${month}|${region}` — when that scope was last reported/closed.
   * A trip changed after this is NOT covered by that report. */
  reportedAt: Map<string, Date>;
  /**
   * The trip's per-trip fuel cost + display figures, applying the full
   * precedence: frozen snapshot → live per-vehicle pool → unset(0).
   * `km` = end − start odometer. This is the single source every fuel-showing
   * screen calls so the rule stays identical everywhere.
   *
   * `changedAt` = the trip's own last change (updated_at, else created_at). A
   * trip created or edited AFTER the scope's report cannot be taking its frozen
   * numbers — it wasn't in it — so it falls through to the live pool and reads
   * "Tạm tính" until the report is regenerated (BUG-260730 case 1). Omit only
   * where no trip timestamp is at hand.
   */
  fuelForTrip(month: string, vehicleId: string | null, km: number, changedAt?: Date | null): TruckTripFuel;
  /** True when a report/close covers the trip: one exists for its (month,
   * region) — or a consolidated (region '') one — AND, when `changedAt` is
   * given, was generated at/after the trip's last change. Drives "Đã lập BC". */
  isReported(month: string, vehicleId: string | null, changedAt?: Date | null): boolean;
}

export async function loadTruckRegionSnapshots(
  entId: string,
  months: string[],
): Promise<TruckRegionSnapshots> {
  const snap = new Map<string, RegionSnapshot>();
  /* Per-vehicle frozen reconciliation (REQ-20260726) — wins over `snap`. */
  const vehicleSnap = new Map<string, VehicleFuelSnapshot>();
  /* Every (month, region) that has ≥1 WHOLE-REGION live report or legacy close
   * — regardless of whether a fuel snapshot could be computed. region ''
   * = consolidated. A report scoped to a vehicle SUBSET (REQ-20260817,
   * trr_vehicle_ids) never marks this — it must not flag vehicles it doesn't
   * cover as "reported" (that's what `vehicleReportedAt` below is for). */
  const reported = new Set<string>();
  /* Latest WHOLE-REGION report/close moment per scope — the cut-off that
   * decides whether a given trip is covered by it. */
  const reportedAt = new Map<string, Date>();
  /* Keyed `${month}|${vehicleId}` — latest moment a vehicle-SUBSET report
   * covered this specific vehicle (REQ-20260817). A whole-region report's
   * coverage is already captured by `reported`/`reportedAt` above; this only
   * needs to track the narrower case. */
  const vehicleReportedAt = new Map<string, Date>();
  const vehicleRegion = new Map<string, string>();

  if (months.length > 0) {
    const uniqMonths = [...new Set(months)];
    const [closeRows, reportRows] = await Promise.all([
      db
        .select({
          month: carTruckMonthClose.tmcMonth,
          region: carTruckMonthClose.tmcRegion,
          avgPrice: carTruckMonthClose.tmcAvgPrice,
          consumption: carTruckMonthClose.tmcConsumption,
          at: carTruckMonthClose.tmcClosedAt,
        })
        .from(carTruckMonthClose)
        .where(
          and(
            eq(carTruckMonthClose.entId, entId),
            eq(carTruckMonthClose.tmcVehicleType, 'TRUCK'),
            inArray(carTruckMonthClose.tmcMonth, uniqMonths),
            isNull(carTruckMonthClose.tmcDeletedAt),
          ),
        ),
      /* ALL live reports (snapshot or not) — needed for `reported`; the `snap`
       * map is filled only from the rows that actually froze a snapshot. */
      db
        .select({
          month: carTruckReports.trrMonth,
          region: carTruckReports.trrRegion,
          avgPrice: carTruckReports.trrAvgPrice,
          consumption: carTruckReports.trrConsumption,
          vehicleFuel: carTruckReports.trrVehicleFuel,
          /* Vehicle scope this report covers (REQ-20260817). NULL/empty = the
           * WHOLE region (or every region, when `region` is also null) — same
           * meaning as every report generated before this column existed. */
          vehicleIds: carTruckReports.trrVehicleIds,
          at: carTruckReports.trrCreatedAt,
        })
        .from(carTruckReports)
        .where(
          and(
            eq(carTruckReports.entId, entId),
            eq(carTruckReports.trrVehicleType, 'TRUCK'),
            inArray(carTruckReports.trrMonth, uniqMonths),
            isNull(carTruckReports.trrDeletedAt),
          ),
        )
        .orderBy(asc(carTruckReports.trrCreatedAt)),
    ]);
    /* Legacy closes first, then report snapshots in creation order — each
     * overwrite leaves the NEWEST report as the official (month, region) value. */
    const markReported = (key: string, at: Date | null) => {
      reported.add(key);
      if (!at) return;
      const prev = reportedAt.get(key);
      if (!prev || at > prev) reportedAt.set(key, at);
    };
    for (const c of closeRows) {
      markReported(snapKey(c.month, c.region ?? ''), c.at ?? null);
      if (c.avgPrice != null && c.consumption != null) {
        snap.set(snapKey(c.month, c.region ?? ''), {
          avgPrice: parseAmount(c.avgPrice),
          consumption: parseAmount(c.consumption),
        });
      }
    }
    /* Fold every live report IN CREATION ORDER (REQ-20260817, BL-1) — not just
     * the newest per (month, region). A WHOLE-REGION report (`vehicleIds`
     * null/empty — every report before this feature, and any new one that
     * doesn't narrow by vehicle) still behaves exactly as before: the newest
     * one wins outright for the whole scope, superseding the region pool and
     * any earlier per-vehicle entries.
     *
     * A vehicle-SUBSET report only gets to overwrite the vehicles it actually
     * names. This is the fix for the regression REQ-20260814 §6.1 flagged:
     * generating a report for 2/8 trucks must not erase the other 6 trucks'
     * already-frozen numbers or their "Đã lập BC" status — under the OLD
     * "latest report per scope wins wholesale" rule it would. Iterating in
     * ascending `at` order and only ever OVERWRITING (never clearing) the
     * vehicles a report actually covers means a later, narrower report can
     * update its own vehicles while every other vehicle keeps whatever the
     * last report that DID cover it left behind. */
    for (const r of reportRows) {
      const key = snapKey(r.month, r.region ?? '');
      const vf = r.vehicleFuel ?? [];
      const scope = r.vehicleIds && r.vehicleIds.length > 0 ? new Set(r.vehicleIds) : null;

      if (!scope) {
        /* Whole-region (or consolidated, region '') report — unchanged from
         * AS-IS: marks the scope reported, and a per-vehicle freeze supersedes
         * the region pool entirely for this scope. */
        markReported(key, r.at ?? null);
        if (vf.length > 0) {
          snap.delete(key);
          for (const v of vf) {
            if (!v?.vehicleId || !(v.costPerKm > 0)) continue;
            vehicleSnap.set(snapKey(r.month, v.vehicleId), {
              costPerKm: v.costPerKm,
              avgPrice: v.avgPrice,
              consumption: v.km > 0 ? v.liters / v.km : 0,
            });
          }
        } else if (r.avgPrice != null && r.consumption != null) {
          snap.set(key, {
            avgPrice: parseAmount(r.avgPrice),
            consumption: parseAmount(r.consumption),
          });
        }
        continue;
      }

      /* Vehicle-subset report — touches ONLY its own vehicles. Never deletes
       * the region pool (`snap`), never marks the whole scope `reported`: the
       * vehicles it doesn't name must keep reading whatever an earlier (or
       * later) whole-region report — or nothing — left them at. */
      const at = r.at ?? null;
      for (const vehicleId of scope) {
        if (!at) continue;
        const prev = vehicleReportedAt.get(snapKey(r.month, vehicleId));
        if (!prev || at > prev) vehicleReportedAt.set(snapKey(r.month, vehicleId), at);
      }
      for (const v of vf) {
        if (!v?.vehicleId || !scope.has(v.vehicleId) || !(v.costPerKm > 0)) continue;
        vehicleSnap.set(snapKey(r.month, v.vehicleId), {
          costPerKm: v.costPerKm,
          avgPrice: v.avgPrice,
          consumption: v.km > 0 ? v.liters / v.km : 0,
        });
      }
    }
  }

  const [vrows, livePool] = await Promise.all([
    db
      .select({ id: carVehicles.cvhId, region: carVehicles.cvhRegion })
      .from(carVehicles)
      .where(and(eq(carVehicles.entId, entId), eq(carVehicles.cvhType, 'TRUCK'))),
    /* The live allocation basis — same aggregation the report freezes, so
     * "tạm tính" and "đã lập BC" can only differ by fuel recorded afterwards. */
    loadVehicleFuelPool(entId, months),
  ]);
  for (const v of vrows) vehicleRegion.set(v.id, v.region ?? '');

  const forTrip = (month: string, vehicleId: string | null): RegionSnapshot | null => {
    const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
    /* Prefer the trip's own region snapshot; fall back to a whole-fleet /
     * consolidated one (region '') so an "all regions" report reconciles
     * every trip. */
    return snap.get(snapKey(month, region)) ?? snap.get(snapKey(month, '')) ?? null;
  };

  /** When the trip's scope was last reported/closed — own region, the
   * consolidated one, or (REQ-20260817) a vehicle-subset report that named
   * this vehicle specifically — whichever is latest. Null when none apply. */
  const frozenAt = (month: string, vehicleId: string | null): Date | null => {
    const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
    const candidates = [
      reportedAt.get(snapKey(month, region)),
      reportedAt.get(snapKey(month, '')),
      vehicleId ? vehicleReportedAt.get(snapKey(month, vehicleId)) : undefined,
    ];
    let latest: Date | null = null;
    for (const d of candidates) if (d && (!latest || d > latest)) latest = d;
    return latest;
  };

  /** Is this trip inside the report that froze its scope? A trip created or
   * edited after the report ran was never part of it. No timestamp given →
   * assume covered (callers that can't supply one keep the old behaviour). */
  const coveredByReport = (month: string, vehicleId: string | null, changedAt?: Date | null): boolean => {
    if (!changedAt) return true;
    const at = frozenAt(month, vehicleId);
    return at != null && at >= changedAt;
  };

  return {
    snap,
    vehicleSnap,
    vehicleRegion,
    livePool,
    reportedAt,
    forTrip,
    fuelForTrip(month, vehicleId, km, changedAt) {
      const covered = coveredByReport(month, vehicleId, changedAt);
      /* 1) The vehicle's OWN frozen spend, spread by km (REQ-20260726). */
      const vs = covered && vehicleId ? vehicleSnap.get(snapKey(month, vehicleId)) : undefined;
      if (vs) {
        return {
          cost: km > 0 ? Math.round(km * vs.costPerKm) : 0,
          unitPrice: vs.avgPrice,
          liters: km > 0 ? km * vs.consumption : 0,
          costPerKm: Math.round(vs.costPerKm),
          mode: 'AVERAGED',
        };
      }
      /* 2) Legacy region-pool snapshot (reports made before 0024). */
      const s = covered ? forTrip(month, vehicleId) : null;
      if (s) {
        return {
          cost: truckTripFuelCost({ km, consumption: s.consumption, avgPrice: s.avgPrice }),
          unitPrice: s.avgPrice,
          liters: km > 0 ? km * s.consumption : 0,
          costPerKm: Math.round(s.consumption * s.avgPrice),
          mode: 'AVERAGED',
        };
      }
      /* 3) Nothing frozen yet → allocate from the vehicle's fuel recorded so
       * far this month. Provisional (more fuel may still be entered), but it is
       * real money and the same formula the report will freeze. */
      const pool = vehicleId ? livePool.get(fuelPoolKey(month, vehicleId)) : undefined;
      if (pool && pool.costPerKm > 0) {
        const consumption = pool.km > 0 ? pool.liters / pool.km : 0;
        return {
          cost: km > 0 ? Math.round(km * pool.costPerKm) : 0,
          unitPrice: pool.avgPrice,
          liters: km > 0 ? km * consumption : 0,
          costPerKm: Math.round(pool.costPerKm),
          mode: 'LIVE',
        };
      }
      return { cost: 0, unitPrice: 0, liters: 0, costPerKm: 0, mode: 'UNSET' };
    },
    isReported(month, vehicleId, changedAt) {
      const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
      /* Covered by a WHOLE-REGION report (or consolidated), OR — REQ-20260817
       * — by a vehicle-subset report that specifically named this vehicle.
       * Either is enough for "some report exists"; `coveredByReport` below
       * still checks the actual timestamp against `changedAt`. */
      const exists =
        reported.has(snapKey(month, region)) ||
        reported.has(snapKey(month, '')) ||
        (vehicleId ? vehicleReportedAt.has(snapKey(month, vehicleId)) : false);
      if (!exists) return false;
      /* A trip added/edited after the report is not in it — showing "Đã lập BC"
       * on a brand-new trip because some earlier report covered its month was
       * the whole complaint (BUG-260730 case 1). */
      return coveredByReport(month, vehicleId, changedAt);
    },
  };
}
