import { pgTable, char, varchar, decimal, date, timestamp, index } from 'drizzle-orm/pg-core';
import { vehicleTypeEnum } from './vehicles.schema';

/**
 * car_truck_fuel_invoices — monthly fuel purchase ledger per fleet department
 * (REQ-20260623 Pha 2 / P3 "hoá đơn xăng dầu tháng").
 *
 * Feeds the finance screen's fuel reconciliation: monthly average price =
 * mean(tfi_price); consumption rate (L/km) = Σ liters ÷ Σ trip km. Purely
 * analytical — per-trip cost still uses the trip's own liters × price, so this
 * ledger never changes computed profit. Money DECIMAL(14,2), liters DECIMAL(10,2).
 */
export const carTruckFuelInvoices = pgTable(
  'car_truck_fuel_invoices',
  {
    tfiId: char('tfi_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    tfiVehicleType: vehicleTypeEnum('tfi_vehicle_type').notNull().default('TRUCK'),
    /* Operating region (REQ-20260630) — code from TRUCK_REGIONS; nullable.
     * Region-scoped month close reconciles fuel from this region's invoices ÷
     * this region's trip km. NULL = unassigned / whole-fleet (legacy). */
    tfiRegion: varchar('tfi_region', { length: 40 }),
    /* 'YYYY-MM' the invoice belongs to (derived from tfi_date on insert). */
    tfiMonth: varchar('tfi_month', { length: 7 }).notNull(),
    tfiDate: date('tfi_date').notNull(),
    tfiStation: varchar('tfi_station', { length: 120 }),
    tfiLiters: decimal('tfi_liters', { precision: 10, scale: 2 }).notNull().default('0'),
    tfiPrice: decimal('tfi_price', { precision: 14, scale: 2 }).notNull().default('0'),
    tfiCreatedBy: char('tfi_created_by', { length: 36 }),
    tfiCreatedAt: timestamp('tfi_created_at', { withTimezone: true }).defaultNow().notNull(),
    tfiDeletedAt: timestamp('tfi_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxEntTypeMonth: index('idx_car_truck_fuel_invoices_ent_type_month').on(
      t.entId,
      t.tfiVehicleType,
      t.tfiMonth,
    ),
  }),
);

export type CarTruckFuelInvoice = typeof carTruckFuelInvoices.$inferSelect;
export type CarTruckFuelInvoiceInsert = typeof carTruckFuelInvoices.$inferInsert;
