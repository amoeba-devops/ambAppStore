import { isNull } from 'drizzle-orm';
import {
  char,
  decimal,
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

/**
 * Fleet department discriminator (REQ-20260617 fleet-access). A vehicle belongs
 * to exactly one fleet department — CAR (passenger dispatch) or TRUCK (cargo
 * trip-log). Default 'CAR' keeps the existing single-fleet MVP intact; the
 * column is the canonical tag that fleet-scoped queries filter on, and that a
 * driver's single-department membership is checked against.
 */
export const vehicleTypeEnum = pgEnum('car_vehicle_type', ['CAR', 'TRUCK']);

export const carVehicles = pgTable(
  'car_vehicles',
  {
    cvhId: char('cvh_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    cvhPlateNumber: varchar('cvh_plate_number', { length: 20 }).notNull(),
    /* Free-text internal code / registration ("Mã xe") shown in the truck fleet
     * table (REQ-20260629). Nullable. */
    cvhCode: varchar('cvh_code', { length: 120 }),
    cvhModel: varchar('cvh_model', { length: 100 }).notNull(),
    cvhMake: varchar('cvh_make', { length: 50 }),
    cvhYear: smallint('cvh_year'),
    cvhColor: varchar('cvh_color', { length: 50 }),
    cvhFuelType: vehicleFuelEnum('cvh_fuel_type').notNull().default('PETROL'),
    /* Fleet department: CAR (default, dispatch) | TRUCK (cargo trip-log). */
    cvhType: vehicleTypeEnum('cvh_type').notNull().default('CAR'),
    /* Truck-only attributes (nullable for cars). cvh_tonnage = tải trọng (tấn). */
    cvhTonnage: decimal('cvh_tonnage', { precision: 6, scale: 2 }),
    /* Operating region (REQ-20260630, "Khu vực"). Code from TRUCK_REGIONS
     * (HCM / DONG_NAI / BAIKSAN); nullable. Drives the region-scoped dashboard
     * breakdown + region-scoped month close (a trip inherits its vehicle's
     * region). Stored as a code; UI labels come from i18n. */
    cvhRegion: varchar('cvh_region', { length: 40 }),
    /* Default driver for this truck (QA 2026-07). "1 xe ↔ 1 tài xế": this driver's
     * fixed monthly salary feeds the vehicle's monthly P&L fixed cost when no
     * manual car_truck_fixed_costs row exists. Nullable; app-level ref to drv_id. */
    cvhDefaultDriverId: char('cvh_default_driver_id', { length: 36 }),
    /* Monthly depreciation (VND) — a default fixed cost carried on the vehicle so
     * the P&L can attribute it without a manual monthly entry. Nullable. */
    cvhDepreciation: decimal('cvh_depreciation', { precision: 14, scale: 2 }),
    cvhStatus: vehicleStatusEnum('cvh_status').notNull().default('AVAILABLE'),
    cvhOdometerKm: integer('cvh_odometer_km').notNull().default(0),
    cvhLastOilChangeKm: integer('cvh_last_oil_change_km'),
    cvhLastOilChangeAt: timestamp('cvh_last_oil_change_at', { withTimezone: true }),
    cvhOilIntervalKm: integer('cvh_oil_interval_km').notNull().default(5000),
    cvhOilIntervalMonths: smallint('cvh_oil_interval_months').notNull().default(3),
    /* Vehicle inspection (đăng kiểm) — added in REQ-20260519 for Maintenance Alert. */
    cvhLastInspectionAt: timestamp('cvh_last_inspection_at', { withTimezone: true }),
    cvhNextInspectionAt: timestamp('cvh_next_inspection_at', { withTimezone: true }),
    cvhInspectionIntervalMonths: smallint('cvh_inspection_interval_months')
      .notNull()
      .default(12),
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
    /* Fleet-scoped listing ("vehicles in the TRUCK department"). */
    idxEntType: index('idx_car_vehicles_ent_type').on(t.entId, t.cvhType),
    /* Region-scoped listing / dashboard breakdown. */
    idxEntTypeRegion: index('idx_car_vehicles_ent_type_region').on(t.entId, t.cvhType, t.cvhRegion),
  }),
);

export type CarVehicle = typeof carVehicles.$inferSelect;
export type CarVehicleInsert = typeof carVehicles.$inferInsert;
export type CarVehicleStatus = (typeof vehicleStatusEnum.enumValues)[number];
export type CarVehicleFuel = (typeof vehicleFuelEnum.enumValues)[number];
export type CarVehicleType = (typeof vehicleTypeEnum.enumValues)[number];
