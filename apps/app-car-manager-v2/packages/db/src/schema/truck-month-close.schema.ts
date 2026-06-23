import { isNull } from 'drizzle-orm';
import { pgTable, char, varchar, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { vehicleTypeEnum } from './vehicles.schema';

/**
 * car_truck_month_close — financial period lock per fleet department × month
 * (REQ-20260623 Pha 2 / G1 "Chốt sổ tháng").
 *
 * A live (non-deleted) row means that (ent, vehicle_type, month) is CLOSED:
 * its truck trips are frozen (no create/edit/delete/complete) and the P&L is
 * official. Reopening soft-deletes the row, recording who + a mandatory reason
 * (also written to the audit log). Absence of a live row = OPEN.
 *
 * `tmc_vehicle_type` defaults to TRUCK; reserved so the same lock can cover the
 * CAR department later without a schema change.
 */
export const carTruckMonthClose = pgTable(
  'car_truck_month_close',
  {
    tmcId: char('tmc_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    tmcVehicleType: vehicleTypeEnum('tmc_vehicle_type').notNull().default('TRUCK'),
    /* 'YYYY-MM' the close applies to. */
    tmcMonth: varchar('tmc_month', { length: 7 }).notNull(),
    tmcClosedBy: char('tmc_closed_by', { length: 36 }),
    tmcClosedAt: timestamp('tmc_closed_at', { withTimezone: true }).defaultNow().notNull(),
    /* Reopen audit (mandatory reason captured at reopen). */
    tmcReopenReason: text('tmc_reopen_reason'),
    tmcReopenedBy: char('tmc_reopened_by', { length: 36 }),
    tmcReopenedAt: timestamp('tmc_reopened_at', { withTimezone: true }),
    tmcDeletedAt: timestamp('tmc_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /* One live close per (ent, dept, month). Re-closing after reopen is fine —
     * the partial index only counts live rows. */
    uniqEntTypeMonth: uniqueIndex('uniq_car_truck_month_close_ent_type_month')
      .on(t.entId, t.tmcVehicleType, t.tmcMonth)
      .where(isNull(t.tmcDeletedAt)),
    idxEntType: index('idx_car_truck_month_close_ent_type').on(t.entId, t.tmcVehicleType),
  }),
);

export type CarTruckMonthClose = typeof carTruckMonthClose.$inferSelect;
export type CarTruckMonthCloseInsert = typeof carTruckMonthClose.$inferInsert;
