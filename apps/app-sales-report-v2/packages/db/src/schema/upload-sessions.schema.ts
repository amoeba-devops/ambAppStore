import { pgTable, char, date, integer, text, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const uploadSessionStatusEnum = pgEnum('sal_upload_session_status', [
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'FINALIZED',
]);

export const uploadGranularityEnum = pgEnum('sal_upload_granularity', ['WEEKLY', 'MONTHLY']);

export const salUploadSessions = pgTable(
  'sal_upload_sessions',
  {
    upsId: char('ups_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    usrId: char('usr_id', { length: 36 }).notNull(),
    upsPeriodStart: date('ups_period_start', { mode: 'date' }).notNull(),
    upsPeriodEnd: date('ups_period_end', { mode: 'date' }).notNull(),
    upsGranularity: uploadGranularityEnum('ups_granularity').notNull(),
    upsStatus: uploadSessionStatusEnum('ups_status').notNull().default('PENDING'),
    upsWorkerId: char('ups_worker_id', { length: 64 }),
    upsRetryCount: integer('ups_retry_count').notNull().default(0),
    upsMaxRetries: integer('ups_max_retries').notNull().default(3),
    upsNextRetryAt: timestamp('ups_next_retry_at', { withTimezone: true }),
    upsErrorLog: text('ups_error_log'),
    upsStartedAt: timestamp('ups_started_at', { withTimezone: true }),
    upsFinalizedAt: timestamp('ups_finalized_at', { withTimezone: true }),
    upsFinalizeCount: integer('ups_finalize_count').notNull().default(0),
    upsLastUnfinalizedBy: char('ups_last_unfinalized_by', { length: 36 }),
    upsLastUnfinalizedAt: timestamp('ups_last_unfinalized_at', { withTimezone: true }),
    upsCreatedAt: timestamp('ups_created_at', { withTimezone: true }).defaultNow().notNull(),
    upsUpdatedAt: timestamp('ups_updated_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntPeriod: uniqueIndex('uniq_sal_ups_ent_period').on(
      t.entId,
      t.upsPeriodStart,
      t.upsPeriodEnd,
      t.upsGranularity,
    ),
    idxStatusCreated: index('idx_sal_ups_status_created').on(t.upsStatus, t.upsCreatedAt),
  }),
);

export type SalUploadSession = typeof salUploadSessions.$inferSelect;
export type SalUploadSessionInsert = typeof salUploadSessions.$inferInsert;
