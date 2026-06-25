import { sql } from 'drizzle-orm';
import {
  pgTable,
  char,
  varchar,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Versioned KRW → VND exchange rate. Versioning is by `fxrEffectiveFrom`:
 * the row with the latest `fxrEffectiveFrom <= NOW()` per (entId | global)
 * is the active rate. Admin can insert new rows via Formula Config UI.
 *
 * Finalized reports snapshot this rate into `sal_period_snapshots.psp_fx_rate_snapshot`
 * so historical KRW values don't shift when the live rate changes.
 *
 * `entId IS NULL` → global default fallback row (seeded at epoch).
 */
export const salFxRates = pgTable(
  'sal_fx_rates',
  {
    fxrId: char('fxr_id', { length: 36 }).primaryKey(),
    /** NULL = global default (fallback when entity has no override). */
    entId: char('ent_id', { length: 36 }),
    /** VND per 1 KRW. Precision 10,4 — enough for current rates near 17.5430. */
    fxrVndPerKrw: numeric('fxr_vnd_per_krw', { precision: 10, scale: 4 })
      .notNull()
      .default('17.5430'),
    fxrEffectiveFrom: timestamp('fxr_effective_from', { withTimezone: true })
      .notNull()
      .defaultNow(),
    fxrSourceNote: varchar('fxr_source_note', { length: 255 }),
    fxrCreatedBy: char('fxr_created_by', { length: 36 }),
    fxrCreatedAt: timestamp('fxr_created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    fxrDeletedAt: timestamp('fxr_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxEntEffective: index('idx_sal_fxr_ent_effective')
      .on(t.entId, t.fxrEffectiveFrom.desc())
      .where(sql`fxr_deleted_at IS NULL`),
  }),
);

export type SalFxRate = typeof salFxRates.$inferSelect;
export type SalFxRateInsert = typeof salFxRates.$inferInsert;
