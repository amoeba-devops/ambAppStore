import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMonthClose, carTruckReports, carVehicles } from '@car-v2/db/schema';
import { parseAmount, truckTripFuelCost, truckTripFuelCostByVehicleRate } from './truck-cost';

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
 *    trip's own litres × price. So "finalized" no longer implies a snapshot.
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

/** Per-vehicle default fuel rate (REQ-20260724): quota L/100km + price đ/L. */
export interface VehicleFuelRate {
  quotaPer100Km: number;
  pricePerLitre: number;
}

/** How a trip's fuel cost was derived (drives the badge + toast copy):
 *  - AVERAGED     → frozen month-end reconciliation. Since REQ-20260726 this is
 *    preferably the VEHICLE's own spend spread over its trips by km
 *    (`km × costPerKm`); legacy reports fall back to the region pool
 *    (`km × consumption × avgPrice`).
 *  - VEHICLE_RATE → the vehicle's own quota × price (km × quota/100 × price)
 *  - UNSET        → no snapshot AND the vehicle lacks quota/price → cost 0 */
export type TruckFuelMode = 'AVERAGED' | 'VEHICLE_RATE' | 'UNSET';

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
  /** vehicleId → its own fuel rate (quota + price), when both are set. */
  vehicleRate: Map<string, VehicleFuelRate>;
  /** Look up the frozen fuel snapshot for a trip (null → use vehicle rate). */
  forTrip(month: string, vehicleId: string | null): RegionSnapshot | null;
  /**
   * The trip's per-trip fuel cost + display figures, applying the full
   * precedence (REQ-20260724): frozen snapshot → vehicle rate → unset(0).
   * `km` = end − start odometer. This is the single source every fuel-showing
   * screen calls so the rule stays identical everywhere.
   */
  fuelForTrip(month: string, vehicleId: string | null, km: number): TruckTripFuel;
  /** True when a report/close exists for the trip's (month, region) — or a
   * consolidated (region '') one covers it — regardless of whether a fuel
   * snapshot was frozen. Drives the "Đã lập BC" status. */
  isReported(month: string, vehicleId: string | null): boolean;
}

export async function loadTruckRegionSnapshots(
  entId: string,
  months: string[],
): Promise<TruckRegionSnapshots> {
  const snap = new Map<string, RegionSnapshot>();
  /* Per-vehicle frozen reconciliation (REQ-20260726) — wins over `snap`. */
  const vehicleSnap = new Map<string, VehicleFuelSnapshot>();
  /* Every (month, region) that has ≥1 live report or legacy close — regardless
   * of whether a fuel snapshot could be computed. region '' = consolidated. */
  const reported = new Set<string>();
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
    for (const c of closeRows) {
      reported.add(snapKey(c.month, c.region ?? ''));
      if (c.avgPrice != null && c.consumption != null) {
        snap.set(snapKey(c.month, c.region ?? ''), {
          avgPrice: parseAmount(c.avgPrice),
          consumption: parseAmount(c.consumption),
        });
      }
    }
    for (const r of reportRows) {
      reported.add(snapKey(r.month, r.region ?? ''));
      if (r.avgPrice != null && r.consumption != null) {
        snap.set(snapKey(r.month, r.region ?? ''), {
          avgPrice: parseAmount(r.avgPrice),
          consumption: parseAmount(r.consumption),
        });
      }
      /* Per-vehicle freeze (REQ-20260726) — newest report covering a vehicle
       * wins, same "creation order, last write" rule as the region snapshot. */
      for (const v of r.vehicleFuel ?? []) {
        if (!v?.vehicleId || !(v.costPerKm > 0)) continue;
        vehicleSnap.set(snapKey(r.month, v.vehicleId), {
          costPerKm: v.costPerKm,
          avgPrice: v.avgPrice,
          consumption: v.km > 0 ? v.liters / v.km : 0,
        });
      }
    }
  }

  const vehicleRate = new Map<string, VehicleFuelRate>();
  const vrows = await db
    .select({
      id: carVehicles.cvhId,
      region: carVehicles.cvhRegion,
      quota: carVehicles.cvhFuelQuota,
      price: carVehicles.cvhFuelPrice,
    })
    .from(carVehicles)
    .where(and(eq(carVehicles.entId, entId), eq(carVehicles.cvhType, 'TRUCK')));
  for (const v of vrows) {
    vehicleRegion.set(v.id, v.region ?? '');
    const quota = parseAmount(v.quota);
    const price = parseAmount(v.price);
    if (quota > 0 && price > 0) vehicleRate.set(v.id, { quotaPer100Km: quota, pricePerLitre: price });
  }

  const forTrip = (month: string, vehicleId: string | null): RegionSnapshot | null => {
    const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
    /* Prefer the trip's own region snapshot; fall back to a whole-fleet /
     * consolidated one (region '') so an "all regions" report reconciles
     * every trip. */
    return snap.get(snapKey(month, region)) ?? snap.get(snapKey(month, '')) ?? null;
  };

  return {
    snap,
    vehicleSnap,
    vehicleRegion,
    vehicleRate,
    forTrip,
    fuelForTrip(month, vehicleId, km) {
      /* 1) The vehicle's OWN frozen spend, spread by km (REQ-20260726). */
      const vs = vehicleId ? vehicleSnap.get(snapKey(month, vehicleId)) : undefined;
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
      const s = forTrip(month, vehicleId);
      if (s) {
        return {
          cost: truckTripFuelCost({ km, consumption: s.consumption, avgPrice: s.avgPrice }),
          unitPrice: s.avgPrice,
          liters: km > 0 ? km * s.consumption : 0,
          costPerKm: Math.round(s.consumption * s.avgPrice),
          mode: 'AVERAGED',
        };
      }
      /* 3) The vehicle's configured rate (định mức + giá của xe). */
      const rate = vehicleId ? vehicleRate.get(vehicleId) : undefined;
      if (rate) {
        const consumption = rate.quotaPer100Km / 100;
        return {
          cost: truckTripFuelCostByVehicleRate({
            km,
            quotaPer100Km: rate.quotaPer100Km,
            pricePerLitre: rate.pricePerLitre,
          }),
          unitPrice: rate.pricePerLitre,
          liters: km > 0 ? km * consumption : 0,
          costPerKm: Math.round(consumption * rate.pricePerLitre),
          mode: 'VEHICLE_RATE',
        };
      }
      return { cost: 0, unitPrice: 0, liters: 0, costPerKm: 0, mode: 'UNSET' };
    },
    isReported(month, vehicleId) {
      const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
      return reported.has(snapKey(month, region)) || reported.has(snapKey(month, ''));
    },
  };
}
