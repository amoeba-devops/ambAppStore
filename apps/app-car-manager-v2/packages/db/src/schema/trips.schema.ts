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
import { carDrivers } from './drivers.schema';
import { carUsers } from './users.schema';
import { carVehicles } from './vehicles.schema';

/**
 * car_trips — trip request + lifecycle.
 * REQ-20260513 §3.1.3 · PRD §9.1 state machine.
 *
 * trp_driver_id / trp_vehicle_id are NULLABLE per PRD divergence D1/D2 (PRD
 * §9.1, REQ §1.3): Admin may assign these later.
 */

export const tripStatusEnum = pgEnum('car_trip_status', [
  'PENDING_ASSIGNMENT',
  'PENDING_DRIVER_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED_BY_DRIVER',
  'CANCELLED',
]);

export const carTrips = pgTable(
  'car_trips',
  {
    trpId: char('trp_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    trpRef: varchar('trp_ref', { length: 20 }).notNull(),
    trpCreatorId: char('trp_creator_id', { length: 36 })
      .notNull()
      .references(() => carUsers.usrId),
    trpPassengerId: char('trp_passenger_id', { length: 36 }).references(() => carUsers.usrId),
    trpDriverId: char('trp_driver_id', { length: 36 }).references(() => carDrivers.drvId),
    trpVehicleId: char('trp_vehicle_id', { length: 36 }).references(() => carVehicles.cvhId),
    trpStatus: tripStatusEnum('trp_status').notNull().default('PENDING_ASSIGNMENT'),
    trpPickupAddress: text('trp_pickup_address').notNull(),
    trpDropoffAddress: text('trp_dropoff_address').notNull(),
    /* Optional contact phone for the passenger. Used by the driver's
     * tap-to-call button (`tel:`) on `/trips/[id]`. Nullable because most
     * existing rows pre-date this column and re-entering numbers retroactively
     * isn't reasonable; UI hides the affordance when null. */
    trpPassengerPhone: varchar('trp_passenger_phone', { length: 20 }),
    trpScheduledAt: timestamp('trp_scheduled_at', { withTimezone: true }).notNull(),
    trpDurationMinutes: smallint('trp_duration_minutes'),
    trpPurpose: varchar('trp_purpose', { length: 255 }),
    trpNotes: text('trp_notes'),
    trpGoogleMapsUrl: text('trp_google_maps_url'),
    trpStartedAt: timestamp('trp_started_at', { withTimezone: true }),
    trpEndedAt: timestamp('trp_ended_at', { withTimezone: true }),
    trpStartOdometer: integer('trp_start_odometer'),
    trpEndOdometer: integer('trp_end_odometer'),
    trpRejectReason: text('trp_reject_reason'),
    trpCancelReason: text('trp_cancel_reason'),
    trpCreatedAt: timestamp('trp_created_at', { withTimezone: true }).defaultNow().notNull(),
    trpUpdatedAt: timestamp('trp_updated_at', { withTimezone: true }),
    trpDeletedAt: timestamp('trp_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntRef: uniqueIndex('uniq_car_trips_ent_ref')
      .on(t.entId, t.trpRef)
      .where(isNull(t.trpDeletedAt)),
    idxEntStatusScheduled: index('idx_car_trips_ent_status_scheduled').on(
      t.entId,
      t.trpStatus,
      t.trpScheduledAt,
    ),
    idxCreator: index('idx_car_trips_creator').on(t.trpCreatorId),
    idxDriver: index('idx_car_trips_driver').on(t.trpDriverId),
    idxVehicle: index('idx_car_trips_vehicle').on(t.trpVehicleId),
  }),
);

export type CarTrip = typeof carTrips.$inferSelect;
export type CarTripInsert = typeof carTrips.$inferInsert;
export type CarTripStatus = (typeof tripStatusEnum.enumValues)[number];
