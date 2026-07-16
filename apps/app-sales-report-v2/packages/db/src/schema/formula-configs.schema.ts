import { sql } from 'drizzle-orm';
import {
  pgTable,
  char,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Versioned generic-purpose configuration table for "formula parameters" —
 * constants and categorical settings that drive calculator behaviour and were
 * previously hardcoded in TypeScript.
 *
 * Versioning model mirrors `sal_fx_rates`: the row with the latest
 * `ffc_effective_from <= NOW()` per (entId | global, ffcKey) is the active
 * value. To "change" a param, Admin INSERTs a new row (we never UPDATE in
 * place) — this preserves full history + ensures snapshot reproducibility.
 *
 * `entId IS NULL` rows are the global default and apply to every entity that
 * has no per-ent override. Per-entity rows override the global for that
 * entity only.
 *
 * Values are stored as `varchar` strings; the actual data type is encoded in
 * `ffcValueType` and parsed at load time (loader + registry coordinate the
 * type cast). This keeps the table schema stable as new param types are
 * added.
 */
export const salFormulaConfigs = pgTable(
  'sal_formula_configs',
  {
    ffcId: char('ffc_id', { length: 36 }).primaryKey(),
    /** NULL = global default; otherwise scopes the override to this entity. */
    entId: char('ent_id', { length: 36 }),
    /** Registry key, e.g. 'tiktok_platform_fee_rate_pct'. Validated against the registry on write. */
    ffcKey: varchar('ffc_key', { length: 64 }).notNull(),
    /** Raw value; parser interprets it per `ffcValueType`. */
    ffcValue: varchar('ffc_value', { length: 255 }).notNull(),
    /** Type discriminator: 'numeric' | 'percentage' | 'currency' | 'date' | 'enum'. */
    ffcValueType: varchar('ffc_value_type', { length: 16 }).notNull(),
    /** Optional unit hint for display (e.g. '%', 'VND', 'KRW'). */
    ffcUnit: varchar('ffc_unit', { length: 16 }),
    /** Active from this timestamp; loader picks the latest active row at the period date. */
    ffcEffectiveFrom: timestamp('ffc_effective_from', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Free-text audit note (who/why), shown in the History drawer. */
    ffcSourceNote: varchar('ffc_source_note', { length: 255 }),
    ffcCreatedBy: char('ffc_created_by', { length: 36 }),
    ffcCreatedAt: timestamp('ffc_created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    ffcDeletedAt: timestamp('ffc_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxEntKeyEffective: index('idx_sal_ffc_ent_key_effective')
      .on(t.entId, t.ffcKey, t.ffcEffectiveFrom.desc())
      .where(sql`ffc_deleted_at IS NULL`),
  }),
);

export type SalFormulaConfig = typeof salFormulaConfigs.$inferSelect;
export type SalFormulaConfigInsert = typeof salFormulaConfigs.$inferInsert;

export type FormulaValueType = 'numeric' | 'percentage' | 'currency' | 'date' | 'enum';
