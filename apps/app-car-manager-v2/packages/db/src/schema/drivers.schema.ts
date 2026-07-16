import { isNull } from 'drizzle-orm';
import {
  char,
  date,
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';

/**
 * car_drivers — driver profile, 1:1 with car_users where usr_local_role = 'DRIVER'.
 * REQ-20260513 §3.1.2 · Open Q3: drv_user_id NOT NULL.
 */

export const driverStatusEnum = pgEnum('car_driver_status', [
  'AVAILABLE',
  'ON_TRIP',
  'OFF_DUTY',
  'UNAVAILABLE',
]);

export const driverLicenseClassEnum = pgEnum('car_driver_license_class', [
  'A2',
  'B1',
  'B2',
  'C',
  'D',
  'E',
  'F',
]);

export const carDrivers = pgTable(
  'car_drivers',
  {
    drvId: char('drv_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    drvUserId: char('drv_user_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    drvLicenseNumber: varchar('drv_license_number', { length: 50 }).notNull(),
    drvLicenseClass: driverLicenseClassEnum('drv_license_class').notNull().default('B2'),
    drvLicenseExpiry: date('drv_license_expiry').notNull(),
    drvPhone: varchar('drv_phone', { length: 20 }),
    drvStatus: driverStatusEnum('drv_status').notNull().default('AVAILABLE'),
    drvEmergencyContact: varchar('drv_emergency_contact', { length: 100 }),
    /* Fixed monthly salary — TRUCK drivers only; feeds the truck P&L driver-
     * salary line. NULL = not set (treated as 0). DECIMAL string convention. */
    drvFixedSalary: decimal('drv_fixed_salary', { precision: 14, scale: 2 }),
    drvNotes: text('drv_notes'),
    drvCreatedAt: timestamp('drv_created_at', { withTimezone: true }).defaultNow().notNull(),
    drvUpdatedAt: timestamp('drv_updated_at', { withTimezone: true }),
    drvDeletedAt: timestamp('drv_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntUser: uniqueIndex('uniq_car_drivers_ent_user')
      .on(t.entId, t.drvUserId)
      .where(isNull(t.drvDeletedAt)),
    idxEntStatus: index('idx_car_drivers_ent_status').on(t.entId, t.drvStatus),
    idxLicenseExpiry: index('idx_car_drivers_license_expiry').on(t.drvLicenseExpiry),
  }),
);

export type CarDriver = typeof carDrivers.$inferSelect;
export type CarDriverInsert = typeof carDrivers.$inferInsert;
export type CarDriverStatus = (typeof driverStatusEnum.enumValues)[number];
export type CarDriverLicenseClass = (typeof driverLicenseClassEnum.enumValues)[number];
