import {
  pgTable,
  char,
  date,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { uploadGranularityEnum } from './upload-sessions.schema';

/**
 * Period snapshot — one row per (ent_id, period). Stores all computed metrics
 * for the period as a JSONB blob (Shopee + TikTok platform totals + breakdowns).
 *
 * Why JSONB instead of normalized rows:
 *   For MVP, the snapshot maps 1:1 to the WeeklyReportData shape consumed by
 *   the dashboard. Avoids ~10 join tables. Trade-off: schema-flexible but
 *   harder to query individual metrics. Acceptable until trending engine
 *   needs cross-week aggregation (then we'll normalize).
 */
export const salPeriodSnapshots = pgTable(
  'sal_period_snapshots',
  {
    pspId: char('psp_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    pspPeriodStart: date('psp_period_start', { mode: 'date' }).notNull(),
    pspPeriodEnd: date('psp_period_end', { mode: 'date' }).notNull(),
    pspGranularity: uploadGranularityEnum('psp_granularity').notNull(),
    pspWeekNum: integer('psp_week_num'),
    pspMonthIdx: integer('psp_month_idx'),
    pspYear: integer('psp_year').notNull(),
    /** Created by which user (ingester). */
    pspCreatedBy: char('psp_created_by', { length: 36 }).notNull(),
    /** Computed metrics blob — WeeklyReportData-shaped (Shopee + TikTok). */
    pspMetrics: jsonb('psp_metrics').notNull(),
    pspCreatedAt: timestamp('psp_created_at', { withTimezone: true }).defaultNow().notNull(),
    pspUpdatedAt: timestamp('psp_updated_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntPeriod: uniqueIndex('uniq_sal_psp_ent_period').on(
      t.entId,
      t.pspPeriodStart,
      t.pspPeriodEnd,
      t.pspGranularity,
    ),
  }),
);

export type SalPeriodSnapshot = typeof salPeriodSnapshots.$inferSelect;
export type SalPeriodSnapshotInsert = typeof salPeriodSnapshots.$inferInsert;
