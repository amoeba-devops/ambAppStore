import { sql } from 'drizzle-orm';
import {
  pgTable,
  char,
  varchar,
  numeric,
  timestamp,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { salPrimeCosts } from './prime-costs.schema';

/**
 * Per-effective-date selling-price versions. Phase 1.2 of the inventory-cost
 * evolution — Shopee Net GMV (sellingPrice × itemSold) is now date-aware, so
 * historical orders use the price that was in effect at order time.
 *
 * See [REQ-20260526-price-versioning](../../../../docs/analysis/REQ-20260526-price-versioning.md).
 */
export const salSellingPriceVersions = pgTable(
  'sal_selling_price_versions',
  {
    spvId: char('spv_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    pcsId: char('pcs_id', { length: 36 })
      .notNull()
      .references(() => salPrimeCosts.pcsId, { onDelete: 'cascade' }),
    spvEffectiveFrom: date('spv_effective_from', { mode: 'string' }).notNull(),
    spvSellingPriceVnd: numeric('spv_selling_price_vnd', { precision: 18, scale: 2 }).notNull(),
    spvSourceNote: varchar('spv_source_note', { length: 255 }),
    spvCreatedBy: char('spv_created_by', { length: 36 }).notNull(),
    spvCreatedAt: timestamp('spv_created_at', { withTimezone: true }).defaultNow().notNull(),
    spvUpdatedAt: timestamp('spv_updated_at', { withTimezone: true }),
    spvDeletedAt: timestamp('spv_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntSkuDate: uniqueIndex('uniq_sal_spv_ent_sku_date')
      .on(t.entId, t.pcsId, t.spvEffectiveFrom)
      .where(sql`spv_deleted_at IS NULL`),
    idxEntSkuDate: index('idx_sal_spv_ent_sku_date').on(t.entId, t.pcsId, t.spvEffectiveFrom),
    idxEntEff: index('idx_sal_spv_ent_eff').on(t.entId, t.spvEffectiveFrom),
  }),
);

export type SalSellingPriceVersion = typeof salSellingPriceVersions.$inferSelect;
export type SalSellingPriceVersionInsert = typeof salSellingPriceVersions.$inferInsert;
