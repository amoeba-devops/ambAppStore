import { isNull } from 'drizzle-orm';
import {
  char,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core';
import { carUsers } from './users.schema';
import { carVehicles } from './vehicles.schema';

/**
 * car_maintenance_alerts — snapshot of oil-change / inspection due reminders.
 * REQ-20260519 §3.7. Generated daily by cron + auto-resolved by OIL expense.
 *
 * Idempotency rule (BR-10): a new alert of the same (vehicle, type) is NOT
 * created if one already exists with mal_resolved_at IS NULL in the last 24h.
 */

export const maintenanceAlertTypeEnum = pgEnum('car_maintenance_alert_type', [
  'OIL_OVERDUE',
  'OIL_DUE_SOON',
  'INSPECTION_OVERDUE',
  'INSPECTION_DUE_SOON',
]);

export const maintenanceAlertSeverityEnum = pgEnum('car_maintenance_alert_severity', [
  'WARNING',
  'CRITICAL',
]);

export const carMaintenanceAlerts = pgTable(
  'car_maintenance_alerts',
  {
    malId: char('mal_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    malVehicleId: char('mal_vehicle_id', { length: 36 })
      .notNull()
      .references(() => carVehicles.cvhId),
    malType: maintenanceAlertTypeEnum('mal_type').notNull(),
    malSeverity: maintenanceAlertSeverityEnum('mal_severity').notNull(),
    /* For INSPECTION_*: the deadline. For OIL_*: NULL (km-driven). */
    malDueAt: timestamp('mal_due_at', { withTimezone: true }),
    /* For OIL_*: target odometer at which oil change is due. */
    malDueKm: integer('mal_due_km'),
    malCurrentOdometerKm: integer('mal_current_odometer_km'),
    /* Admin/manager click "Đã xử lý" — alert stays visible but de-emphasized. */
    malAcknowledgedAt: timestamp('mal_acknowledged_at', { withTimezone: true }),
    malAcknowledgedBy: char('mal_acknowledged_by', { length: 36 }).references(
      () => carUsers.usrId,
    ),
    /* Set when an OIL expense is created (auto) or admin resets manually. */
    malResolvedAt: timestamp('mal_resolved_at', { withTimezone: true }),
    malCreatedAt: timestamp('mal_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxEntUnresolved: index('idx_car_maintenance_alerts_ent_unresolved')
      .on(t.entId, t.malVehicleId)
      .where(isNull(t.malResolvedAt)),
    idxVehicleTypeCreated: index('idx_car_maintenance_alerts_vehicle_type_created').on(
      t.malVehicleId,
      t.malType,
      t.malCreatedAt,
    ),
  }),
);

export type CarMaintenanceAlert = typeof carMaintenanceAlerts.$inferSelect;
export type CarMaintenanceAlertInsert = typeof carMaintenanceAlerts.$inferInsert;
export type CarMaintenanceAlertType = (typeof maintenanceAlertTypeEnum.enumValues)[number];
export type CarMaintenanceAlertSeverity = (typeof maintenanceAlertSeverityEnum.enumValues)[number];
