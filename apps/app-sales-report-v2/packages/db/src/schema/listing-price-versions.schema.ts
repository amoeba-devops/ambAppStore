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
 * Per-effective-date listing-price versions. Phase 1.2 of the inventory-cost
 * evolution — TikTok GMV (listingPrice × itemSold) is now date-aware, so
 * historical orders use the price that was in effect at order time.
 *
 * See [REQ-20260526-price-versioning](../../../../docs/analysis/REQ-20260526-price-versioning.md).
 */
export const salListingPriceVersions = pgTable(
  'sal_listing_price_versions',
  {
    lpvId: char('lpv_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    pcsId: char('pcs_id', { length: 36 })
      .notNull()
      .references(() => salPrimeCosts.pcsId, { onDelete: 'cascade' }),
    lpvEffectiveFrom: date('lpv_effective_from', { mode: 'string' }).notNull(),
    lpvListingPriceVnd: numeric('lpv_listing_price_vnd', { precision: 18, scale: 2 }).notNull(),
    lpvSourceNote: varchar('lpv_source_note', { length: 255 }),
    lpvCreatedBy: char('lpv_created_by', { length: 36 }).notNull(),
    lpvCreatedAt: timestamp('lpv_created_at', { withTimezone: true }).defaultNow().notNull(),
    lpvUpdatedAt: timestamp('lpv_updated_at', { withTimezone: true }),
    lpvDeletedAt: timestamp('lpv_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntSkuDate: uniqueIndex('uniq_sal_lpv_ent_sku_date')
      .on(t.entId, t.pcsId, t.lpvEffectiveFrom)
      .where(sql`lpv_deleted_at IS NULL`),
    idxEntSkuDate: index('idx_sal_lpv_ent_sku_date').on(t.entId, t.pcsId, t.lpvEffectiveFrom),
    idxEntEff: index('idx_sal_lpv_ent_eff').on(t.entId, t.lpvEffectiveFrom),
  }),
);

export type SalListingPriceVersion = typeof salListingPriceVersions.$inferSelect;
export type SalListingPriceVersionInsert = typeof salListingPriceVersions.$inferInsert;
