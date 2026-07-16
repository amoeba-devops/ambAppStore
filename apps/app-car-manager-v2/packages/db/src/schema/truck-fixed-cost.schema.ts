import { pgTable, char, varchar, decimal, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { carVehicles } from './vehicles.schema';

/**
 * car_truck_fixed_costs — monthly fixed costs per truck (REQ-20260617).
 * Feeds the P&L screen: net profit = revenue − variable (fuel/toll/extra) −
 * fixed (salary + depreciation + insurance). One row per (truck, month).
 *
 * tfc_month stored as 'YYYY-MM-01' DATE for easy range filtering.
 * Money is DECIMAL(14,2) string — same convention as car_expenses.
 */
export const carTruckFixedCosts = pgTable(
  'car_truck_fixed_costs',
  {
    tfcId: char('tfc_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    cvhId: char('cvh_id', { length: 36 })
      .notNull()
      .references(() => carVehicles.cvhId),
    /* First day of the month the costs apply to, e.g. 2025-10-01. */
    tfcMonth: varchar('tfc_month', { length: 7 }).notNull(),
    tfcSalary: decimal('tfc_salary', { precision: 14, scale: 2 }).notNull().default('0'),
    tfcDepreciation: decimal('tfc_depreciation', { precision: 14, scale: 2 }).notNull().default('0'),
    tfcInsurance: decimal('tfc_insurance', { precision: 14, scale: 2 }).notNull().default('0'),
    tfcCreatedAt: timestamp('tfc_created_at', { withTimezone: true }).defaultNow().notNull(),
    tfcUpdatedAt: timestamp('tfc_updated_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntVehicleMonth: uniqueIndex('uniq_car_truck_fixed_costs_ent_vehicle_month').on(
      t.entId,
      t.cvhId,
      t.tfcMonth,
    ),
    idxEntMonth: index('idx_car_truck_fixed_costs_ent_month').on(t.entId, t.tfcMonth),
  }),
);

export type CarTruckFixedCost = typeof carTruckFixedCosts.$inferSelect;
export type CarTruckFixedCostInsert = typeof carTruckFixedCosts.$inferInsert;
