import { isNull } from 'drizzle-orm';
import { char, date, decimal, index, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { carVehicles } from './vehicles.schema';

/**
 * car_truck_maintenances — one maintenance job per truck (REQ-20260904).
 *
 * A row says: truck `cvh_id` was in the shop from `tmn_start_date` to
 * `tmn_end_date` (inclusive, DATE granularity) and it cost `tmn_cost`. Two
 * consumers, both month-level:
 *
 *   1. P&L — the month's maintenance total is the THIRD component of the fixed
 *      cost (`computeTruckPnl`: fixedCost = salary + depreciation +
 *      maintenanceCost). It is NEVER spread over trips (`trr_fixed_alloc` /
 *      `loadTruckFixedAllocation` stay salary + depreciation only) and is NOT
 *      zeroed for a month with no trips — a truck sitting in the shop all month
 *      is exactly the case the cost is real.
 *   2. Scheduling — while a live row covers a date, no LOG trip may be created,
 *      assigned, edited or imported for that truck on that date (hard block,
 *      CAR-E1013). Symmetrically a row can't be created over dates the truck
 *      already has trips on (CAR-E1014).
 *
 * `tmn_month` = the START date's 'YYYY-MM' — the whole cost books into that
 * month, no day-prorating across a month boundary. Stored (not derived on
 * read) so the P&L can `inArray(tmn_month, months)` like `tfc_month`.
 *
 * Money DECIMAL(14,2) string, same convention as car_truck_fixed_costs.
 * Soft delete via tmn_deleted_at (CLAUDE.md §8).
 */
export const carTruckMaintenances = pgTable(
  'car_truck_maintenances',
  {
    tmnId: char('tmn_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    cvhId: char('cvh_id', { length: 36 })
      .notNull()
      .references(() => carVehicles.cvhId),
    /* 'YYYY-MM-DD' — inclusive range. */
    tmnStartDate: date('tmn_start_date').notNull(),
    tmnEndDate: date('tmn_end_date').notNull(),
    /* Accounting month = start month ('YYYY-MM'). */
    tmnMonth: varchar('tmn_month', { length: 7 }).notNull(),
    tmnCost: decimal('tmn_cost', { precision: 14, scale: 2 }).notNull().default('0'),
    tmnCreatedBy: char('tmn_created_by', { length: 36 }),
    tmnCreatedAt: timestamp('tmn_created_at', { withTimezone: true }).defaultNow().notNull(),
    tmnUpdatedBy: char('tmn_updated_by', { length: 36 }),
    tmnUpdatedAt: timestamp('tmn_updated_at', { withTimezone: true }),
    tmnDeletedAt: timestamp('tmn_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /* "Is this truck under maintenance on date D?" — the trip-block lookup. */
    idxEntVehicleRange: index('idx_car_truck_maintenances_ent_vehicle_range')
      .on(t.entId, t.cvhId, t.tmnStartDate, t.tmnEndDate)
      .where(isNull(t.tmnDeletedAt)),
    /* Month rollup for the P&L. */
    idxEntMonth: index('idx_car_truck_maintenances_ent_month').on(t.entId, t.tmnMonth),
  }),
);

export type CarTruckMaintenance = typeof carTruckMaintenances.$inferSelect;
export type CarTruckMaintenanceInsert = typeof carTruckMaintenances.$inferInsert;
