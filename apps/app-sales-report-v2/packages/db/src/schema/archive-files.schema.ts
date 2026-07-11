import {
  pgTable,
  char,
  varchar,
  bigint,
  integer,
  date,
  timestamp,
  index,
  customType,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Drizzle doesn't ship a first-class BYTEA helper for postgres-js; use the
// `customType` escape hatch so we round-trip Buffer ↔ Postgres BYTEA cleanly.
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});
import { uploadGranularityEnum } from './upload-sessions.schema.js';

/**
 * Channel of the uploaded file (Shopee / TikTok). Used to filter archive views.
 */
export const archiveChannelEnum = pgEnum('sal_archive_channel', ['SHOPEE', 'TIKTOK']);

/**
 * Type of the uploaded file — maps 1:1 to the 9 upload slots in Step 2 of the
 * upload wizard.
 */
export const archiveFileTypeEnum = pgEnum('sal_archive_file_type', [
  'SALES',
  'ADS',
  'BRAND_ADS',
  'OFF_PLATFORM_ADS',
  'TRAFFIC',
  'AFFILIATE',
  // Added in migration 0018 — TikTok split the single Affiliate export into 3
  // order-level reports. AFFILIATE remains as the "Creator" variant for
  // backward compat; the next two are new slot types.
  'AFFILIATE_PARTNER',
  'AFFILIATE_NONCOLLAB',
]);

/**
 * Immutable archive of every raw file uploaded via the ingest wizard. Per
 * NFR-06: originals must be preserved exactly as ingested — re-uploads create
 * a new row with a bumped `arf_revision`; the previous revision is NOT
 * mutated (soft-deleted via `arf_replaced_at`).
 *
 * `arf_s3_key` may be NULL when S3 credentials aren't configured — in that
 * case only metadata is recorded and download is disabled.
 */
export const salArchiveFiles = pgTable(
  'sal_archive_files',
  {
    arfId: char('arf_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    /** Period this file belongs to (Friday-Thursday for WEEKLY, calendar for MONTHLY). */
    arfPeriodStart: date('arf_period_start', { mode: 'date' }).notNull(),
    arfPeriodEnd: date('arf_period_end', { mode: 'date' }).notNull(),
    arfGranularity: uploadGranularityEnum('arf_granularity').notNull(),
    arfWeekNum: integer('arf_week_num'),
    arfMonthIdx: integer('arf_month_idx'),
    arfYear: integer('arf_year').notNull(),
    arfChannel: archiveChannelEnum('arf_channel').notNull(),
    arfFileType: archiveFileTypeEnum('arf_file_type').notNull(),
    /** Original filename as uploaded by the operator. */
    arfFilename: varchar('arf_filename', { length: 512 }).notNull(),
    /** S3 object key (e.g. `ent/<ent_id>/W19_2026/shopee_sales_<arfId>.csv`). NULL if S3 was unavailable at ingest. */
    arfS3Key: varchar('arf_s3_key', { length: 1024 }),
    /** File size in bytes. */
    arfSizeBytes: bigint('arf_size_bytes', { mode: 'number' }).notNull(),
    /** SHA-256 hex digest for integrity verification. NULL if not computed. */
    arfSha256: char('arf_sha256', { length: 64 }),
    /** Detected MIME type / extension (e.g. "text/csv", "xlsx"). */
    arfMimeType: varchar('arf_mime_type', { length: 255 }),
    /** Number of data rows successfully parsed from this file. */
    arfRowCount: integer('arf_row_count'),
    /**
     * Inline copy of the uploaded bytes — populated when S3 isn't configured
     * (or as a redundancy when it is). Lets the download endpoint serve the
     * file without depending on external object storage. NULL for legacy rows
     * uploaded before this column existed.
     *
     * Hard-capped at 50 MB per file inside `archiveFile()` to keep DB size
     * predictable; oversized files fall back to S3-only.
     */
    arfRawBytes: bytea('arf_raw_bytes'),
    /** Revision number — re-uploads bump this; revision 1 is the original. */
    arfRevision: integer('arf_revision').notNull().default(1),
    /** When this revision was replaced by a newer upload. NULL = current. */
    arfReplacedAt: timestamp('arf_replaced_at', { withTimezone: true }),
    arfUploadedBy: char('arf_uploaded_by', { length: 36 }).notNull(),
    arfUploadedAt: timestamp('arf_uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxEntPeriod: index('idx_sal_arf_ent_period').on(
      t.entId,
      t.arfPeriodStart,
      t.arfPeriodEnd,
      t.arfGranularity,
    ),
    idxEntCurrent: index('idx_sal_arf_ent_current').on(t.entId, t.arfReplacedAt),
  }),
);

export type SalArchiveFile = typeof salArchiveFiles.$inferSelect;
export type SalArchiveFileInsert = typeof salArchiveFiles.$inferInsert;
