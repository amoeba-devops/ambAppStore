import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckMaintenances, carUsers, carVehicles } from '@car-v2/db/schema';
import { countMaintenanceAttachments, getMaintenanceAttachments, parseAmount } from '@car-v2/core/truck';
import { getSignedGetUrl } from '@/lib/s3-client';

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
  /** Free-text note (REQ-20260914); null when never filled. */
  note: string | null;
  /** Live invoice files on the job — list shows a paperclip badge (REQ-20260914). */
  attachmentCount: number;
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
  note: carTruckMaintenances.tmnNote,
  createdAt: carTruckMaintenances.tmnCreatedAt,
  updatedAt: carTruckMaintenances.tmnUpdatedAt,
  updatedByName: carUsers.usrName,
};

/* Last editor, else creator — one join instead of two. */
const editorJoin = eq(
  carUsers.usrId,
  sql`coalesce(${carTruckMaintenances.tmnUpdatedBy}, ${carTruckMaintenances.tmnCreatedBy})`,
);

function toRow(
  r: {
    id: string;
    vehicleId: string;
    plate: string;
    model: string;
    region: string | null;
    startDate: string;
    endDate: string;
    month: string;
    cost: string;
    note: string | null;
    createdAt: Date;
    updatedAt: Date | null;
    updatedByName: string | null;
  },
  attachmentCount = 0,
): TruckMaintenanceRow {
  return { ...r, cost: Math.round(parseAmount(r.cost)), attachmentCount };
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
  /* One extra query for the paperclip badge — no signed URLs here, the list
   * only needs the count (REQ-20260914). */
  const counts = await countMaintenanceAttachments(entId, rows.map((r) => r.id));
  return rows.map((r) => toRow(r, counts.get(r.id) ?? 0));
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
  if (!row) return null;
  const counts = await countMaintenanceAttachments(entId, [row.id]);
  return toRow(row, counts.get(row.id) ?? 0);
}

/** One maintenance invoice, ready to render (REQ-20260914). Mirrors the trip
 * receipt view model so the shared attachment field can consume both. */
export interface MaintenanceAttachmentView {
  id: string;
  s3Key: string;
  mime: string;
  sizeBytes: number;
  /** Short-lived GET URL for the thumbnail; null when signing failed. */
  signedUrl: string | null;
}

/** Live invoices of a job with signed URLs — the edit/detail screen. */
export async function getTruckMaintenanceAttachmentsView(
  entId: string,
  maintenanceId: string,
): Promise<MaintenanceAttachmentView[]> {
  const rows = await getMaintenanceAttachments(entId, maintenanceId);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.tmaId,
      s3Key: r.tmaS3Key,
      mime: r.tmaMime,
      sizeBytes: r.tmaSizeBytes,
      signedUrl: await getSignedGetUrl(r.tmaS3Key),
    })),
  );
}
