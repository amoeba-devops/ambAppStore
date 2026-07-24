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

/** Per-vehicle default fuel rate (REQ-20260724): quota L/100km + price đ/L. */
export interface VehicleFuelRate {
  quotaPer100Km: number;
  pricePerLitre: number;
}

/** How a trip's fuel cost was derived (drives the badge + toast copy):
 *  - AVERAGED     → frozen month-end reconciliation (km × consumption × avg price)
 *  - VEHICLE_RATE → the vehicle's own quota × price (km × quota/100 × price)
 *  - UNSET        → no snapshot AND the vehicle lacks quota/price → cost 0 */
export type TruckFuelMode = 'AVERAGED' | 'VEHICLE_RATE' | 'UNSET';

export interface TruckTripFuel {
  cost: number;
  /** Unit price shown (đ/L): avg price (averaged) or vehicle price (rate); 0 when unset. */
  unitPrice: number;
  /** Litres shown: km × consumption; 0 when unset. */
  liters: number;
  mode: TruckFuelMode;
}

const snapKey = (month: string, region: string): string => `${month}|${region}`;

export interface TruckRegionSnapshots {
  /** Keyed `${month}|${region}` — only present when that region's month has a
   * computable fuel snapshot (invoices → avg price + consumption). region '' =
   * a consolidated "all regions" / legacy whole-fleet snapshot. */
  snap: Map<string, RegionSnapshot>;
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
    vehicleRegion,
    vehicleRate,
    forTrip,
    fuelForTrip(month, vehicleId, km) {
      const s = forTrip(month, vehicleId);
      if (s) {
        return {
          cost: truckTripFuelCost({ km, consumption: s.consumption, avgPrice: s.avgPrice }),
          unitPrice: s.avgPrice,
          liters: km > 0 ? km * s.consumption : 0,
          mode: 'AVERAGED',
        };
      }
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
          mode: 'VEHICLE_RATE',
        };
      }
      return { cost: 0, unitPrice: 0, liters: 0, mode: 'UNSET' };
    },
    isReported(month, vehicleId) {
      const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
      return reported.has(snapKey(month, region)) || reported.has(snapKey(month, ''));
    },
  };
}
