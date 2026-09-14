import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMaintenances, carUsers, carVehicles } from '@car-v2/db/schema';
import { parseAmount } from '@car-v2/core/truck';

/**
 * Read side of the truck maintenance menu (REQ-20260904). The money/schedule
 * rules live in `@car-v2/core/truck/truck-maintenance` — this file only shapes
 * rows for the list and edit screens.
 */

export interface TruckMaintenanceRow {
  id: string;
  vehicleId: string;
  plate: string;
  model: string;
  /** Vehicle operating region (cvh_region) — a job inherits its truck's region. */
  region: string | null;
  /** 'YYYY-MM-DD' inclusive. */
  startDate: string;
  endDate: string;
  /** Accounting month = start month. */
  month: string;
  /** VND, rounded. */
  cost: number;
  /** "Ngày" column — when the job was recorded (user decision Q4). */
  createdAt: Date;
  /** "Cập nhật" column — last edit, null when never edited. */
  updatedAt: Date | null;
  /** "Cập nhật bởi" — the last editor, else the creator. */
  updatedByName: string | null;
}

const rowSelect = {
  id: carTruckMaintenances.tmnId,
  vehicleId: carTruckMaintenances.cvhId,
  plate: carVehicles.cvhPlateNumber,
  model: carVehicles.cvhModel,
  region: carVehicles.cvhRegion,
  startDate: carTruckMaintenances.tmnStartDate,
  endDate: carTruckMaintenances.tmnEndDate,
  month: carTruckMaintenances.tmnMonth,
  cost: carTruckMaintenances.tmnCost,
  createdAt: carTruckMaintenances.tmnCreatedAt,
  updatedAt: carTruckMaintenances.tmnUpdatedAt,
  updatedByName: carUsers.usrName,
};

/* Last editor, else creator — one join instead of two. */
const editorJoin = eq(
  carUsers.usrId,
  sql`coalesce(${carTruckMaintenances.tmnUpdatedBy}, ${carTruckMaintenances.tmnCreatedBy})`,
);

function toRow(r: {
  id: string;
  vehicleId: string;
  plate: string;
  model: string;
  region: string | null;
  startDate: string;
  endDate: string;
  month: string;
  cost: string;
  createdAt: Date;
  updatedAt: Date | null;
  updatedByName: string | null;
}): TruckMaintenanceRow {
  return { ...r, cost: Math.round(parseAmount(r.cost)) };
}

export interface ListTruckMaintenancesOpts {
  /** Accounting month 'YYYY-MM' (tmn_month). Omit for every month. */
  month?: string;
  /**
   * Trucks the viewer may see — the region ACL pushed down to vehicle ids
   * (`resolveVehicleScope`). An EMPTY array means "no truck permitted" and
   * returns nothing; undefined means no vehicle filter.
   */
  vehicleIds?: readonly string[];
}

/** Live maintenance jobs, newest start date first. */
export async function listTruckMaintenances(
  entId: string,
  opts: ListTruckMaintenancesOpts = {},
): Promise<TruckMaintenanceRow[]> {
  if (opts.vehicleIds && opts.vehicleIds.length === 0) return [];
  const rows = await db
    .select(rowSelect)
    .from(carTruckMaintenances)
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .leftJoin(carUsers, editorJoin)
    .where(
      and(
        eq(carTruckMaintenances.entId, entId),
        isNull(carTruckMaintenances.tmnDeletedAt),
        opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? eq(carTruckMaintenances.tmnMonth, opts.month) : undefined,
        opts.vehicleIds ? inArray(carTruckMaintenances.cvhId, [...opts.vehicleIds]) : undefined,
      ),
    )
    .orderBy(desc(carTruckMaintenances.tmnStartDate), desc(carTruckMaintenances.tmnCreatedAt));
  return rows.map(toRow);
}

/** One live job (ent-scoped) for the edit page; null when missing/deleted. */
export async function getTruckMaintenance(entId: string, id: string): Promise<TruckMaintenanceRow | null> {
  const [row] = await db
    .select(rowSelect)
    .from(carTruckMaintenances)
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .leftJoin(carUsers, editorJoin)
    .where(
      and(
        eq(carTruckMaintenances.entId, entId),
        eq(carTruckMaintenances.tmnId, id),
        isNull(carTruckMaintenances.tmnDeletedAt),
      ),
    )
    .limit(1);
  return row ? toRow(row) : null;
}
