import { pgTable, char, varchar, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { carTrips } from './trips.schema';

/**
 * car_trip_extra_costs — structured "other costs" for a truck trip-log
 * (REQ-20260617). The driver's Complete-Trip form lets them add an arbitrary
 * list of {name, amount} rows (extra fuel, tire patch, car wash, parking…),
 * so costs stay queryable per item instead of a single freetext blob.
 *
 * Money is DECIMAL(14,2) string — same convention as car_expenses.exp_amount.
 */
export const carTripExtraCosts = pgTable(
  'car_trip_extra_costs',
  {
    tecId: char('tec_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    trpId: char('trp_id', { length: 36 })
      .notNull()
      .references(() => carTrips.trpId),
    tecName: varchar('tec_name', { length: 255 }).notNull(),
    tecAmount: decimal('tec_amount', { precision: 14, scale: 2 }).notNull(),
    tecCreatedAt: timestamp('tec_created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxTrip: index('idx_car_trip_extra_costs_trip').on(t.trpId),
    idxEntTrip: index('idx_car_trip_extra_costs_ent_trip').on(t.entId, t.trpId),
  }),
);

export type CarTripExtraCost = typeof carTripExtraCosts.$inferSelect;
export type CarTripExtraCostInsert = typeof carTripExtraCosts.$inferInsert;
