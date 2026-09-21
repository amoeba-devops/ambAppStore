import 'server-only';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carExpenseAttachments,
  carExpenses,
  carTripCostAttachments,
  carTrips,
  carTruckFuelInvoiceAttachments,
  carTruckFuelInvoices,
  carTruckMaintenanceAttachments,
  carTruckMaintenances,
  carUsers,
  carVehicles,
} from '@car-v2/db/schema';
import {
  fileNameFromS3Key,
  tripCostInvoiceType,
  expenseInvoiceType,
  TRUCK_INVOICE_PAGE_SIZE,
  type TruckInvoiceFilterInput,
  type TruckInvoiceSource,
  type TruckInvoiceTypeCode,
} from '@car-v2/shared/zod';
import { requireFleet } from '@/lib/auth/fleet-access';
import { allowedRegions } from '@/lib/auth/region-access';
import { getSignedUrlPair } from '@/lib/s3-client';
import type { AuthContext } from '@/lib/auth/get-current-user';

/**
 * Truck Invoice module (REQ-20260921) — read-only aggregate of every
 * hóa đơn/chứng từ uploaded across 4 sources: trip-cost receipts, maintenance
 * invoices, TRUCK-scoped expense receipts, and (optional) fuel-invoice scans.
 *
 * Each source is its own small, independently-typed query (region + TRUCK
 * scoping pushed down to SQL); the 4 result sets are normalized to one shape,
 * merged, sorted and paginated IN APPLICATION CODE rather than a raw SQL
 * UNION ALL — the 4 tables have unrelated shapes/joins, and at this tenant's
 * data volume (hundreds–low thousands of rows/month) that's simpler and
 * easier to test than fighting Drizzle's typing across a heterogeneous UNION.
 */

export interface TruckInvoiceRow {
  /** `${source}:${attachmentRowId}` — stable React key, not a DB id. */
  id: string;
  source: TruckInvoiceSource;
  typeCode: TruckInvoiceTypeCode;
  /** Business date of the underlying record — NOT the upload timestamp
   * (REQ-20260921 §3.4 / Decision Log D6). */
  date: Date;
  region: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  fileName: string;
  mime: string;
  sizeBytes: number;
  s3Key: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
}

export interface TruckInvoiceListResult {
  rows: (TruckInvoiceRow & { signedUrl: string | null; downloadUrl: string | null })[];
  total: number;
  page: number;
  pageSize: number;
  /** Distinct type codes present after region/vehicle/date filters but BEFORE
   * the type filter itself — feeds the "Loại hóa đơn" dropdown so it only
   * lists types the tenant actually has data for (REQ-20260921 §3.3). */
  availableTypes: TruckInvoiceTypeCode[];
}

const displayName = (fileName: string | null, s3Key: string): string =>
  fileName?.trim() || fileNameFromS3Key(s3Key) || s3Key.split('/').pop() || s3Key;

/** Trip-cost receipts — only LOG (truck) trips; defense-in-depth even though
 * the upload UI already only exposes this on truck trip-logs. */
async function fetchTripCostRows(entId: string, regions: readonly string[] | 'ALL'): Promise<TruckInvoiceRow[]> {
  const conditions = [
    eq(carTripCostAttachments.entId, entId),
    isNull(carTripCostAttachments.tcaDeletedAt),
    eq(carTrips.trpKind, 'LOG' as const),
    isNull(carTrips.trpDeletedAt),
    eq(carVehicles.cvhType, 'TRUCK' as const),
    isNull(carVehicles.cvhDeletedAt),
  ];
  if (regions !== 'ALL') conditions.push(inArray(carVehicles.cvhRegion, [...regions]));

  const rows = await db
    .select({
      id: carTripCostAttachments.tcaId,
      costKind: carTripCostAttachments.tcaCostKind,
      s3Key: carTripCostAttachments.tcaS3Key,
      mime: carTripCostAttachments.tcaMime,
      sizeBytes: carTripCostAttachments.tcaSizeBytes,
      fileName: carTripCostAttachments.tcaFileName,
      uploadedBy: carTripCostAttachments.tcaUploadedBy,
      uploadedByName: carUsers.usrName,
      scheduledAt: carTrips.trpScheduledAt,
      endedAt: carTrips.trpEndedAt,
      vehicleId: carVehicles.cvhId,
      vehiclePlate: carVehicles.cvhPlateNumber,
      region: carVehicles.cvhRegion,
    })
    .from(carTripCostAttachments)
    .innerJoin(carTrips, eq(carTripCostAttachments.trpId, carTrips.trpId))
    .innerJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carUsers.usrId, carTripCostAttachments.tcaUploadedBy))
    .where(and(...conditions));

  return rows.map((r) => ({
    id: `TRIP_COST:${r.id}`,
    source: 'TRIP_COST' as const,
    typeCode: tripCostInvoiceType(r.costKind as Parameters<typeof tripCostInvoiceType>[0]),
    date: r.endedAt ?? r.scheduledAt,
    region: r.region,
    vehicleId: r.vehicleId,
    vehiclePlate: r.vehiclePlate,
    fileName: displayName(r.fileName, r.s3Key),
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    s3Key: r.s3Key,
    uploadedBy: r.uploadedBy,
    uploadedByName: r.uploadedByName,
  }));
}

/** Maintenance invoices — car_truck_maintenances is TRUCK-only by construction. */
async function fetchMaintenanceRows(
  entId: string,
  regions: readonly string[] | 'ALL',
): Promise<TruckInvoiceRow[]> {
  const conditions = [
    eq(carTruckMaintenanceAttachments.entId, entId),
    isNull(carTruckMaintenanceAttachments.tmaDeletedAt),
    isNull(carTruckMaintenances.tmnDeletedAt),
    isNull(carVehicles.cvhDeletedAt),
  ];
  if (regions !== 'ALL') conditions.push(inArray(carVehicles.cvhRegion, [...regions]));

  const rows = await db
    .select({
      id: carTruckMaintenanceAttachments.tmaId,
      s3Key: carTruckMaintenanceAttachments.tmaS3Key,
      mime: carTruckMaintenanceAttachments.tmaMime,
      sizeBytes: carTruckMaintenanceAttachments.tmaSizeBytes,
      fileName: carTruckMaintenanceAttachments.tmaFileName,
      uploadedBy: carTruckMaintenanceAttachments.tmaUploadedBy,
      uploadedByName: carUsers.usrName,
      startDate: carTruckMaintenances.tmnStartDate,
      vehicleId: carVehicles.cvhId,
      vehiclePlate: carVehicles.cvhPlateNumber,
      region: carVehicles.cvhRegion,
    })
    .from(carTruckMaintenanceAttachments)
    .innerJoin(carTruckMaintenances, eq(carTruckMaintenanceAttachments.tmnId, carTruckMaintenances.tmnId))
    .innerJoin(carVehicles, eq(carTruckMaintenances.cvhId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carUsers.usrId, carTruckMaintenanceAttachments.tmaUploadedBy))
    .where(and(...conditions));

  return rows.map((r) => ({
    id: `MAINTENANCE:${r.id}`,
    source: 'MAINTENANCE' as const,
    typeCode: 'MAINTENANCE' as const,
    date: new Date(r.startDate),
    region: r.region,
    vehicleId: r.vehicleId,
    vehiclePlate: r.vehiclePlate,
    fileName: displayName(r.fileName, r.s3Key),
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    s3Key: r.s3Key,
    uploadedBy: r.uploadedBy,
    uploadedByName: r.uploadedByName,
  }));
}

/**
 * Expense receipts — car_expenses/car_expense_attachments are shared CAR+TRUCK
 * (REQ-20260921 R5), so this is the ONE source that needs an explicit TRUCK
 * filter. Vehicle resolves from expVehicleId directly OR (when absent) via the
 * linked trip's vehicle — split into two simple queries rather than one
 * COALESCE-across-join query, each independently typed/testable.
 */
async function fetchExpenseRows(entId: string, regions: readonly string[] | 'ALL'): Promise<TruckInvoiceRow[]> {
  const baseConditions = [
    eq(carExpenseAttachments.entId, entId),
    eq(carExpenses.entId, entId),
    isNull(carExpenses.expDeletedAt),
    eq(carVehicles.cvhType, 'TRUCK' as const),
    isNull(carVehicles.cvhDeletedAt),
  ];
  const regionCondition = regions !== 'ALL' ? [inArray(carVehicles.cvhRegion, [...regions])] : [];

  const direct = await db
    .select({
      id: carExpenseAttachments.eatId,
      expType: carExpenses.expType,
      s3Key: carExpenseAttachments.eatS3Key,
      mime: carExpenseAttachments.eatMime,
      sizeBytes: carExpenseAttachments.eatSizeBytes,
      fileName: carExpenseAttachments.eatFileName,
      uploadedBy: carExpenseAttachments.eatUploadedBy,
      uploadedByName: carUsers.usrName,
      occurredAt: carExpenses.expOccurredAt,
      vehicleId: carVehicles.cvhId,
      vehiclePlate: carVehicles.cvhPlateNumber,
      region: carVehicles.cvhRegion,
    })
    .from(carExpenseAttachments)
    .innerJoin(carExpenses, eq(carExpenseAttachments.eatExpenseId, carExpenses.expId))
    .innerJoin(carVehicles, eq(carExpenses.expVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carUsers.usrId, carExpenseAttachments.eatUploadedBy))
    .where(and(...baseConditions, ...regionCondition));

  const viaTrip = await db
    .select({
      id: carExpenseAttachments.eatId,
      expType: carExpenses.expType,
      s3Key: carExpenseAttachments.eatS3Key,
      mime: carExpenseAttachments.eatMime,
      sizeBytes: carExpenseAttachments.eatSizeBytes,
      fileName: carExpenseAttachments.eatFileName,
      uploadedBy: carExpenseAttachments.eatUploadedBy,
      uploadedByName: carUsers.usrName,
      occurredAt: carExpenses.expOccurredAt,
      vehicleId: carVehicles.cvhId,
      vehiclePlate: carVehicles.cvhPlateNumber,
      region: carVehicles.cvhRegion,
    })
    .from(carExpenseAttachments)
    .innerJoin(carExpenses, eq(carExpenseAttachments.eatExpenseId, carExpenses.expId))
    .innerJoin(carTrips, eq(carExpenses.expTripId, carTrips.trpId))
    .innerJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carUsers.usrId, carExpenseAttachments.eatUploadedBy))
    .where(and(...baseConditions, isNull(carExpenses.expVehicleId), ...regionCondition));

  return [...direct, ...viaTrip].map((r) => ({
    id: `EXPENSE:${r.id}`,
    source: 'EXPENSE' as const,
    typeCode: expenseInvoiceType(r.expType),
    date: new Date(r.occurredAt),
    region: r.region,
    vehicleId: r.vehicleId,
    vehiclePlate: r.vehiclePlate,
    fileName: displayName(r.fileName, r.s3Key),
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    s3Key: r.s3Key,
    uploadedBy: r.uploadedBy,
    uploadedByName: r.uploadedByName,
  }));
}

/** Fuel-invoice scans — optional (R4); car_truck_fuel_invoices is TRUCK-only
 * by construction. tfi_vehicle_id may be NULL (legacy region-level invoice)
 * so the vehicle join is LEFT, not INNER. */
async function fetchFuelInvoiceRows(
  entId: string,
  regions: readonly string[] | 'ALL',
): Promise<TruckInvoiceRow[]> {
  const conditions = [
    eq(carTruckFuelInvoiceAttachments.entId, entId),
    isNull(carTruckFuelInvoiceAttachments.tfaDeletedAt),
    isNull(carTruckFuelInvoices.tfiDeletedAt),
  ];
  if (regions !== 'ALL') conditions.push(inArray(carTruckFuelInvoices.tfiRegion, [...regions]));

  const rows = await db
    .select({
      id: carTruckFuelInvoiceAttachments.tfaId,
      s3Key: carTruckFuelInvoiceAttachments.tfaS3Key,
      mime: carTruckFuelInvoiceAttachments.tfaMime,
      sizeBytes: carTruckFuelInvoiceAttachments.tfaSizeBytes,
      fileName: carTruckFuelInvoiceAttachments.tfaFileName,
      uploadedBy: carTruckFuelInvoiceAttachments.tfaUploadedBy,
      uploadedByName: carUsers.usrName,
      date: carTruckFuelInvoices.tfiDate,
      vehicleId: carVehicles.cvhId,
      vehiclePlate: carVehicles.cvhPlateNumber,
      region: carTruckFuelInvoices.tfiRegion,
    })
    .from(carTruckFuelInvoiceAttachments)
    .innerJoin(carTruckFuelInvoices, eq(carTruckFuelInvoiceAttachments.tfiId, carTruckFuelInvoices.tfiId))
    .leftJoin(carVehicles, eq(carTruckFuelInvoices.tfiVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carUsers.usrId, carTruckFuelInvoiceAttachments.tfaUploadedBy))
    .where(and(...conditions));

  return rows.map((r) => ({
    id: `FUEL_INVOICE:${r.id}`,
    source: 'FUEL_INVOICE' as const,
    typeCode: 'FUEL_INVOICE' as const,
    date: new Date(r.date),
    region: r.region,
    vehicleId: r.vehicleId,
    vehiclePlate: r.vehiclePlate,
    fileName: displayName(r.fileName, r.s3Key),
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    s3Key: r.s3Key,
    uploadedBy: r.uploadedBy,
    uploadedByName: r.uploadedByName,
  }));
}

/**
 * Aggregate + filter + paginate + sign. `requireFleet`/region ACL are applied
 * here too (not just at the `/truck` layout) so this query stands on its own
 * if ever called from a route handler that bypasses the page layout.
 */
export async function getTruckInvoices(
  actor: AuthContext,
  filters: TruckInvoiceFilterInput,
): Promise<TruckInvoiceListResult> {
  await requireFleet(actor, 'TRUCK');
  const scope = await allowedRegions(actor);
  const regions: readonly string[] | 'ALL' = scope.length > 0 ? scope : 'ALL';
  /* Narrow further to the single region param, if given (still inside the
   * actor's own scope — a region outside it never reaches here because the
   * page resolves `?region=` via `resolveRegionFilter` before calling this). */
  const effectiveRegions: readonly string[] | 'ALL' = filters.region
    ? [filters.region]
    : regions;

  const [tripCost, maintenance, expense, fuelInvoice] = await Promise.all([
    fetchTripCostRows(actor.entId, effectiveRegions),
    fetchMaintenanceRows(actor.entId, effectiveRegions),
    fetchExpenseRows(actor.entId, effectiveRegions),
    fetchFuelInvoiceRows(actor.entId, effectiveRegions),
  ]);

  let merged = [...tripCost, ...maintenance, ...expense, ...fuelInvoice];

  if (filters.vehicle_id) merged = merged.filter((r) => r.vehicleId === filters.vehicle_id);
  if (filters.from) merged = merged.filter((r) => r.date >= new Date(filters.from as string));
  if (filters.to) {
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    merged = merged.filter((r) => r.date <= to);
  }
  const q = filters.q?.trim().toLowerCase();
  if (q) merged = merged.filter((r) => r.fileName.toLowerCase().includes(q));

  const availableTypes = [...new Set(merged.map((r) => r.typeCode))];

  if (filters.type) merged = merged.filter((r) => r.typeCode === filters.type);

  merged.sort((a, b) => b.date.getTime() - a.date.getTime());

  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = TRUCK_INVOICE_PAGE_SIZE;
  const total = merged.length;
  const pageRows = merged.slice((page - 1) * pageSize, page * pageSize);

  const rows = await Promise.all(
    pageRows.map(async (r) => ({ ...r, ...(await getSignedUrlPair(r.s3Key, r.fileName, 900)) })),
  );

  return { rows, total, page, pageSize, availableTypes };
}
