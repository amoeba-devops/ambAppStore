import { pgTable, char, varchar, timestamp, index, decimal } from 'drizzle-orm/pg-core';
import { vehicleTypeEnum } from './vehicles.schema';

/**
 * car_truck_reports — metadata for generated monthly truck reports
 * (REQ-20260629, R8). The rendered file (Excel) lives in S3 under
 * `trr_s3_key`; this row records what was generated, for which month/type,
 * by whom. Listing groups by month and flags rows newer than the viewer's
 * `car_users.usr_truck_reports_seen_at` as "Mới" (new).
 *
 * `trr_type`: PNL (chi phí & lợi nhuận) | TRIP_LOG (nhật ký chuyến) |
 * VEHICLE (phương tiện). `trr_format`: EXCEL (PDF reserved).
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

/** Allowed report types (mirrors trr_type). */
export const TRUCK_REPORT_TYPES = ['PNL', 'TRIP_LOG', 'VEHICLE'] as const;
export type TruckReportType = (typeof TRUCK_REPORT_TYPES)[number];
