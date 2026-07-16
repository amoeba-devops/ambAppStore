import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMonthClose, carTruckReports, carVehicles } from '@car-v2/db/schema';
import { parseAmount } from './truck-cost';

/**
 * Region-scoped month-end fuel snapshot (REQ-20260630, report-based since
 * PLAN-20260707). Every "Lập báo cáo" run RECOMPUTES the reconciliation (avg
 * invoice price + consumption) and freezes it onto the report row; the LATEST
 * live report per (ent, month, region) is the official snapshot. Legacy
 * car_truck_month_close rows (the removed manual chốt sổ) remain as fallback so
 * historical closed months keep their numbers. A trip's official fuel cost
 * depends on ITS region (= its vehicle's cvh_region): when that (month, region)
 * has a snapshot it's km × consumption × avg price, otherwise the trip's own
 * litres × price.
 *
 * `loadTruckRegionSnapshots` batches the lookups every fuel-computing site
 * needs (P&L, trip list, finance list, exports) so the rule stays identical
 * across them.
 */
export interface RegionSnapshot {
  avgPrice: number;
  consumption: number;
}

const snapKey = (month: string, region: string): string => `${month}|${region}`;

export interface TruckRegionSnapshots {
  /** Keyed `${month}|${region}` — only present when that region's month is
   * closed AND has a computable snapshot. region '' = unassigned (never closed). */
  snap: Map<string, RegionSnapshot>;
  /** vehicleId → region code ('' when the vehicle has no region). */
  vehicleRegion: Map<string, string>;
  /** Look up the snapshot for a trip given its month + vehicle id. */
  forTrip(month: string, vehicleId: string | null): RegionSnapshot | null;
}

export async function loadTruckRegionSnapshots(
  entId: string,
  months: string[],
): Promise<TruckRegionSnapshots> {
  const snap = new Map<string, RegionSnapshot>();
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
            isNotNull(carTruckReports.trrAvgPrice),
            isNotNull(carTruckReports.trrConsumption),
          ),
        )
        .orderBy(asc(carTruckReports.trrCreatedAt)),
    ]);
    /* Legacy closes first, then report snapshots in creation order — each
     * overwrite leaves the NEWEST report as the official (month, region) value. */
    for (const c of closeRows) {
      if (c.avgPrice != null && c.consumption != null) {
        snap.set(snapKey(c.month, c.region ?? ''), {
          avgPrice: parseAmount(c.avgPrice),
          consumption: parseAmount(c.consumption),
        });
      }
    }
    for (const r of reportRows) {
      snap.set(snapKey(r.month, r.region ?? ''), {
        avgPrice: parseAmount(r.avgPrice),
        consumption: parseAmount(r.consumption),
      });
    }
  }

  const vrows = await db
    .select({ id: carVehicles.cvhId, region: carVehicles.cvhRegion })
    .from(carVehicles)
    .where(and(eq(carVehicles.entId, entId), eq(carVehicles.cvhType, 'TRUCK')));
  for (const v of vrows) vehicleRegion.set(v.id, v.region ?? '');

  return {
    snap,
    vehicleRegion,
    forTrip(month, vehicleId) {
      const region = vehicleId ? vehicleRegion.get(vehicleId) ?? '' : '';
      /* Prefer the trip's own region close; fall back to a whole-fleet close
       * (region '' — a legacy per-month close, or an "all regions" close) so
       * existing closes keep finalizing every trip. */
      return snap.get(snapKey(month, region)) ?? snap.get(snapKey(month, '')) ?? null;
    },
  };
}
