import { sql } from 'drizzle-orm';
import {
  pgTable,
  char,
  varchar,
  numeric,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { salPrimeCosts } from './prime-costs.schema';

/**
 * Per-effective-date prime cost versions. Phase 1 of the inventory-cost
 * evolution: each shipment / cost change adds a new row instead of mutating
 * the master in place. Calculators look up the version active at the order's
 * `Ngày đặt hàng` (Shopee) / `Created Time` (TikTok) date.
 *
 * `breakdown` is an optional jsonb capture of the cost components reported by
 * the user (cogs / logistic / warehousePerDay / fulfillment / notes) — Phase 1
 * stores it verbatim, no compute logic over it yet.
 *
 * See [REQ-20260521-prime-cost-versioning](../../../../docs/analysis/REQ-20260521-prime-cost-versioning.md).
 */
export const salPrimeCostVersions = pgTable(
  'sal_prime_cost_versions',
  {
    pcvId: char('pcv_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    pcsId: char('pcs_id', { length: 36 })
      .notNull()
      .references(() => salPrimeCosts.pcsId, { onDelete: 'cascade' }),
    pcvEffectiveFrom: date('pcv_effective_from', { mode: 'string' }).notNull(),
    pcvPrimeCostVnd: numeric('pcv_prime_cost_vnd', { precision: 18, scale: 2 }).notNull(),
    /** Optional cost breakdown: { cogs, logistic, warehousePerDay, fulfillment, notes } */
    pcvBreakdown: jsonb('pcv_breakdown'),
    pcvSourceNote: varchar('pcv_source_note', { length: 255 }),
    pcvCreatedBy: char('pcv_created_by', { length: 36 }).notNull(),
    pcvCreatedAt: timestamp('pcv_created_at', { withTimezone: true }).defaultNow().notNull(),
    pcvUpdatedAt: timestamp('pcv_updated_at', { withTimezone: true }),
    pcvDeletedAt: timestamp('pcv_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntSkuDate: uniqueIndex('uniq_sal_pcv_ent_sku_date')
      .on(t.entId, t.pcsId, t.pcvEffectiveFrom)
      .where(sql`pcv_deleted_at IS NULL`),
    idxEntSkuDate: index('idx_sal_pcv_ent_sku_date').on(
      t.entId,
      t.pcsId,
      t.pcvEffectiveFrom,
    ),
    idxEntEff: index('idx_sal_pcv_ent_eff').on(t.entId, t.pcvEffectiveFrom),
  }),
);

export type SalPrimeCostVersion = typeof salPrimeCostVersions.$inferSelect;
export type SalPrimeCostVersionInsert = typeof salPrimeCostVersions.$inferInsert;
