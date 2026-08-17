import { pgTable, char, varchar, timestamp, index, decimal, jsonb } from 'drizzle-orm/pg-core';
import { vehicleTypeEnum } from './vehicles.schema';

/**
 * One vehicle's frozen monthly fuel reconciliation inside a report
 * (`trr_vehicle_fuel`, REQ-20260726). All amounts are plain numbers (VND / L /
 * km) — JSON, so no DECIMAL string parsing.
 */
export interface TruckReportVehicleFuel {
  /** cvh_id */
  vehicleId: string;
  /** Σ (litres × unit price) of that vehicle's invoices for the month (VND). */
  money: number;
  /** Σ litres filled. */
  liters: number;
  /** Σ km of the vehicle's completed trips at generation time. */
  km: number;
  /** money ÷ km — what each trip km is charged. */
  costPerKm: number;
  /** Mean invoice unit price (đ/L) — shown as the trip's "Đơn giá". */
  avgPrice: number;
}

/**
 * car_truck_reports — metadata for generated monthly truck reports
 * (REQ-20260629, R8). The rendered file (Excel) lives in S3 under
 * `trr_s3_key`; this row records what was generated, for which month/type,
 * by whom. Listing groups by month and flags rows newer than the viewer's
 * `car_users.usr_truck_reports_seen_at` as "Mới" (new).
 *
 * `trr_type`: PNL (chi phí & lợi nhuận) | TRIP_LOG (nhật ký chuyến) |
 * VEHICLE (phương tiện) | MONTHLY_SUMMARY (tổng kết chi phí tháng — 1 sheet
 * theo template khách, REQ-20260713). `trr_format`: EXCEL (PDF reserved).
 */
export const carTruckReports = pgTable(
  'car_truck_reports',
  {
    trrId: char('trr_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    trrVehicleType: vehicleTypeEnum('trr_vehicle_type').notNull().default('TRUCK'),
    /* 'YYYY-MM' the report covers. */
    trrMonth: varchar('trr_month', { length: 7 }).notNull(),
    /* Operating region the report is scoped to (code from TRUCK_REGIONS —
     * HCM / DONG_NAI / BAIKSAN). NULL = legacy whole-fleet report. Drives the
     * month picker's "Đã xuất X/3 khu vực" badge (distinct non-null regions). */
    trrRegion: varchar('trr_region', { length: 40 }),
    trrType: varchar('trr_type', { length: 16 }).notNull(),
    trrFormat: varchar('trr_format', { length: 8 }).notNull().default('EXCEL'),
    trrS3Key: varchar('trr_s3_key', { length: 512 }).notNull(),
    trrName: varchar('trr_name', { length: 200 }).notNull(),
    /* Month-end fuel reconciliation FROZEN at generation time (0021). The
     * generate action recomputes the old chốt-sổ formulas (avg invoice price,
     * consumption = Σ litres ÷ Σ km) and stores them here; the latest live row
     * per (ent, month, region) is the official snapshot every screen reads.
     * NULL = not computable at generation (no invoices / no km) → screens keep
     * the per-trip provisional numbers. Precision mirrors car_truck_month_close. */
    trrAvgPrice: decimal('trr_avg_price', { precision: 14, scale: 2 }),
    trrConsumption: decimal('trr_consumption', { precision: 10, scale: 6 }),
    trrTotalLiters: decimal('trr_total_liters', { precision: 12, scale: 2 }),
    trrTotalKm: decimal('trr_total_km', { precision: 12, scale: 2 }),
    /* PER-VEHICLE fuel reconciliation frozen at generation time (0024,
     * REQ-20260726) — supersedes the region-level columns above, which stay for
     * reports generated before this change. Each entry is one vehicle in the
     * report's scope: its own monthly fuel spend + km, and the resulting
     * cost/km each trip is charged (`phí chuyến = km chuyến × costPerKm`).
     * Empty array = scope had no per-vehicle invoices to reconcile. */
    trrVehicleFuel: jsonb('trr_vehicle_fuel').$type<TruckReportVehicleFuel[]>(),
    /* Vehicle scope this report covers (REQ-20260817, 0027). NULL = every truck
     * in trr_region (AS-IS meaning, every row before this change). Non-null =
     * this report only freezes/represents these vehicle ids — the fold in
     * loadTruckRegionSnapshots reads this to decide which vehicles a report is
     * allowed to overwrite, so a partial report can never wipe out the frozen
     * numbers of a vehicle it doesn't cover. */
    trrVehicleIds: jsonb('trr_vehicle_ids').$type<string[]>(),
    trrCreatedBy: char('trr_created_by', { length: 36 }),
    trrCreatedAt: timestamp('trr_created_at', { withTimezone: true }).defaultNow().notNull(),
    trrDeletedAt: timestamp('trr_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxEntMonth: index('idx_car_truck_reports_ent_month').on(t.entId, t.trrMonth),
    idxEntMonthRegion: index('idx_car_truck_reports_ent_month_region').on(
      t.entId,
      t.trrMonth,
      t.trrRegion,
    ),
  }),
);

export type CarTruckReport = typeof carTruckReports.$inferSelect;
export type CarTruckReportInsert = typeof carTruckReports.$inferInsert;

/** Allowed report types (mirrors trr_type). MONTHLY_SUMMARY = the client
 * "Tổng kết chi phí tháng" single-sheet template (REQ-20260713); 'MONTHLY_SUMMARY'
 * is 15 chars → fits trr_type varchar(16) with no DDL change. */
export const TRUCK_REPORT_TYPES = ['PNL', 'TRIP_LOG', 'VEHICLE', 'MONTHLY_SUMMARY'] as const;
export type TruckReportType = (typeof TRUCK_REPORT_TYPES)[number];
