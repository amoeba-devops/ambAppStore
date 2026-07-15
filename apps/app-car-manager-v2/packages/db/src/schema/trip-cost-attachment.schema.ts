import { pgTable, char, varchar, text, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { carTrips } from './trips.schema';

/**
 * car_trip_cost_attachments — receipt/invoice/document uploads for a truck
 * trip-log's costs (REQ-20260709). Image + PDF, stored in S3; rows hold the
 * S3 key only, never file bytes (CLAUDE.md §8).
 *
 * Trip-scoped + tagged by `tca_cost_kind` (FUEL / TOLL / EXTRA) rather than
 * FK'd to a specific car_trip_extra_costs row: those rows are delete+reinserted
 * on every trip edit/complete (truck-trip.service.ts), so a per-row FK would
 * orphan on each save. Grouping by cost bucket survives edits cleanly and still
 * associates each receipt with the right cost.
 *
 * Soft delete: removing an attachment sets `tca_deleted_at` and keeps the row +
 * S3 object for audit — reads filter `tca_deleted_at IS NULL`.
 */
export const carTripCostAttachments = pgTable(
  'car_trip_cost_attachments',
  {
    tcaId: char('tca_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    trpId: char('trp_id', { length: 36 })
      .notNull()
      .references(() => carTrips.trpId),
    /** Which cost the receipt documents: FUEL | TOLL | EXTRA. */
    tcaCostKind: varchar('tca_cost_kind', { length: 10 }).notNull(),
    tcaS3Key: text('tca_s3_key').notNull(),
    tcaMime: varchar('tca_mime', { length: 64 }).notNull(),
    tcaSizeBytes: bigint('tca_size_bytes', { mode: 'number' }).notNull(),
    tcaUploadedAt: timestamp('tca_uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    tcaDeletedAt: timestamp('tca_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxTrip: index('idx_car_trip_cost_attachments_trip').on(t.trpId),
    idxEntTrip: index('idx_car_trip_cost_attachments_ent_trip').on(t.entId, t.trpId),
  }),
);

export type CarTripCostAttachment = typeof carTripCostAttachments.$inferSelect;
export type CarTripCostAttachmentInsert = typeof carTripCostAttachments.$inferInsert;
