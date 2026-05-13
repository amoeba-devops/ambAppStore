import { char, index, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import { carTrips } from './trips.schema';

/**
 * car_trip_stopovers — ordered intermediate stops on a trip.
 * REQ-20260513 §3.1.4 · PRD §FR-1.1 (point 6, Stopover field).
 */
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
    tstCreatedAt: timestamp('tst_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxTripOrder: index('idx_car_trip_stopovers_trip_order').on(t.tstTripId, t.tstOrder),
  }),
);

export type CarTripStopover = typeof carTripStopovers.$inferSelect;
export type CarTripStopoverInsert = typeof carTripStopovers.$inferInsert;
