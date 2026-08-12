import { isNull } from 'drizzle-orm';
import { pgTable, char, varchar, decimal, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * car_truck_cost_rates — effective-dated fixed-cost rates (QA 2026-07-30).
 *
 * A truck's monthly fixed cost used to be read from the CURRENT value on the
 * record (`car_vehicles.cvh_depreciation`, `car_drivers.drv_fixed_salary`), so
 * every month — including months before the vehicle was bought, and months
 * whose report was already generated — silently reflected today's numbers. A
 * salary raise in July rewrote June.
 *
 * Each row says "from this month onwards, this rate applies". Resolution for
 * month M = the newest row with `tcr_month <= M`; no such row → 0 (the vehicle
 * or driver did not exist / had no rate yet). `car_truck_fixed_costs` (a manual
 * per-(vehicle, month) entry) still overrides everything for that month.
 *
 * The forms keep editing the current value on the vehicle/driver; the write path
 * additionally stamps a rate row for the CURRENT month, so history accrues
 * without a new screen.
 */
export const carTruckCostRates = pgTable(
  'car_truck_cost_rates',
  {
    tcrId: char('tcr_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    /** What the rate hangs off: 'VEHICLE' (depreciation) | 'DRIVER' (salary). */
    tcrScope: varchar('tcr_scope', { length: 10 }).notNull(),
    /** cvh_id when scope=VEHICLE, drv_id when scope=DRIVER. */
    tcrRefId: char('tcr_ref_id', { length: 36 }).notNull(),
    /** 'DEPRECIATION' | 'SALARY'. */
    tcrKind: varchar('tcr_kind', { length: 20 }).notNull(),
    /** 'YYYY-MM' the rate takes effect from (inclusive). */
    tcrMonth: varchar('tcr_month', { length: 7 }).notNull(),
    tcrAmount: decimal('tcr_amount', { precision: 14, scale: 2 }).notNull().default('0'),
    /** Why it changed — free text, shown if a history screen is ever added. */
    tcrNote: text('tcr_note'),
    tcrCreatedBy: char('tcr_created_by', { length: 36 }),
    tcrCreatedAt: timestamp('tcr_created_at', { withTimezone: true }).defaultNow().notNull(),
    tcrDeletedAt: timestamp('tcr_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /* One live rate per (scope, ref, kind, month) — a re-save in the same month
     * updates that row instead of stacking duplicates. */
    uqLive: uniqueIndex('uq_car_truck_cost_rates_live')
      .on(t.entId, t.tcrScope, t.tcrRefId, t.tcrKind, t.tcrMonth)
      .where(isNull(t.tcrDeletedAt)),
    /* Resolution lookup: newest row <= the queried month. */
    idxLookup: index('idx_car_truck_cost_rates_lookup').on(t.entId, t.tcrScope, t.tcrRefId, t.tcrKind, t.tcrMonth),
  }),
);

export type CarTruckCostRate = typeof carTruckCostRates.$inferSelect;
export type CarTruckCostRateInsert = typeof carTruckCostRates.$inferInsert;
