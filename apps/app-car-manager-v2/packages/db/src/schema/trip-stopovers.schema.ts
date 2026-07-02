import { char, index, integer, pgEnum, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import { carTrips } from './trips.schema';

/**
 * car_trip_stopovers — ordered stops on a trip (REQ-20260623 multi-stop).
 * REQ-20260513 §3.1.4 · PRD §FR-1.1 (point 6, Stopover field).
 *
 * Stop ordering:
 *   ORIGIN (index 1) → PICKUP → WAYPOINT* → DELIVERY → WAYPOINT* → RETURN (last)
 * tst_km is the cumulative odometer reading when the driver arrives at this stop.
 */

export const stopTypeEnum = pgEnum('car_stop_type', [
  'ORIGIN',
  'PICKUP',
  'DELIVERY',
  'WAYPOINT',
  'RETURN',
]);

export const carTripStopovers = pgTable(
  'car_trip_stopovers',
  {
    tstId: char('tst_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    tstTripId: char('tst_trip_id', { length: 36 })
      .notNull()
      .references(() => carTrips.trpId, { onDelete: 'cascade' }),
    tstAddress: text('tst_address').notNull(),
    tstOrder: smallint('tst_order').notNull(),
    /** Stop type (REQ-20260623). Existing rows default to WAYPOINT via SQL migration. */
    tstType: stopTypeEnum('tst_type').notNull().default('WAYPOINT'),
    /** Odometer reading (km) when driver arrives at this stop. Null until updated. */
    tstKm: integer('tst_km'),
    /** When the driver arrived at this stop. Null until updated in real-time. */
    tstArrivedAt: timestamp('tst_arrived_at', { withTimezone: true }),
    /** Optional note at this stop (loading issue, delay reason, etc.). */
    tstNotes: text('tst_notes'),
    tstCreatedAt: timestamp('tst_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxTripOrder: index('idx_car_trip_stopovers_trip_order').on(t.tstTripId, t.tstOrder),
    idxTripType: index('idx_car_trip_stopovers_type').on(t.tstTripId, t.tstType),
  }),
);

export type CarTripStopover = typeof carTripStopovers.$inferSelect;
export type CarTripStopoverInsert = typeof carTripStopovers.$inferInsert;
export type CarStopType = (typeof stopTypeEnum.enumValues)[number];
