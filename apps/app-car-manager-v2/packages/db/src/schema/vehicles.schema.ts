import { isNull } from 'drizzle-orm';
import {
  char,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * car_vehicles — corporate fleet vehicle registry.
 * REQ-20260513 §3.1.1 · CLAUDE.md §4.3 naming.
 */

export const vehicleStatusEnum = pgEnum('car_vehicle_status', [
  'AVAILABLE',
  'IN_USE',
  'MAINTENANCE',
  'RETIRED',
]);

export const vehicleFuelEnum = pgEnum('car_vehicle_fuel', [
  'PETROL',
  'DIESEL',
  'HYBRID',
  'EV',
]);

export const carVehicles = pgTable(
  'car_vehicles',
  {
    cvhId: char('cvh_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    cvhPlateNumber: varchar('cvh_plate_number', { length: 20 }).notNull(),
    cvhModel: varchar('cvh_model', { length: 100 }).notNull(),
    cvhMake: varchar('cvh_make', { length: 50 }),
    cvhYear: smallint('cvh_year'),
    cvhColor: varchar('cvh_color', { length: 50 }),
    cvhFuelType: vehicleFuelEnum('cvh_fuel_type').notNull().default('PETROL'),
    cvhStatus: vehicleStatusEnum('cvh_status').notNull().default('AVAILABLE'),
    cvhOdometerKm: integer('cvh_odometer_km').notNull().default(0),
    cvhLastOilChangeKm: integer('cvh_last_oil_change_km'),
    cvhLastOilChangeAt: timestamp('cvh_last_oil_change_at', { withTimezone: true }),
    cvhOilIntervalKm: integer('cvh_oil_interval_km').notNull().default(5000),
    cvhOilIntervalMonths: smallint('cvh_oil_interval_months').notNull().default(3),
    cvhHomeBase: varchar('cvh_home_base', { length: 100 }),
    cvhNotes: text('cvh_notes'),
    cvhCreatedAt: timestamp('cvh_created_at', { withTimezone: true }).defaultNow().notNull(),
    cvhUpdatedAt: timestamp('cvh_updated_at', { withTimezone: true }),
    cvhDeletedAt: timestamp('cvh_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /* Per-tenant unique plate, only among live rows. */
    uniqEntPlate: uniqueIndex('uniq_car_vehicles_ent_plate')
      .on(t.entId, t.cvhPlateNumber)
      .where(isNull(t.cvhDeletedAt)),
    idxEntStatus: index('idx_car_vehicles_ent_status').on(t.entId, t.cvhStatus),
  }),
);

export type CarVehicle = typeof carVehicles.$inferSelect;
export type CarVehicleInsert = typeof carVehicles.$inferInsert;
export type CarVehicleStatus = (typeof vehicleStatusEnum.enumValues)[number];
export type CarVehicleFuel = (typeof vehicleFuelEnum.enumValues)[number];
