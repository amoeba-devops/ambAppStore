import { sql } from 'drizzle-orm';
import {
  pgTable,
  char,
  varchar,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const salPrimeCosts = pgTable(
  'sal_prime_costs',
  {
    pcsId: char('pcs_id', { length: 36 }).primaryKey(),
    entId: char('ent_id', { length: 36 }).notNull(),
    pcsProductId: varchar('pcs_product_id', { length: 64 }),
    pcsVariationId: varchar('pcs_variation_id', { length: 64 }),
    /** Shopee option/variation display name — e.g. "Phới nhỏ", "Combo nhỏ + lớn". */
    pcsVariationName: varchar('pcs_variation_name', { length: 255 }),
    pcsProductNameVi: varchar('pcs_product_name_vi', { length: 512 }).notNull(),
    pcsProductNameEn: varchar('pcs_product_name_en', { length: 512 }),
    pcsSkuCode: varchar('pcs_sku_code', { length: 128 }).notNull(),
    pcsPrimeCostVnd: numeric('pcs_prime_cost_vnd', { precision: 18, scale: 2 }).notNull(),
    pcsSellingPriceVnd: numeric('pcs_selling_price_vnd', { precision: 18, scale: 2 }),
    pcsListingPriceVnd: numeric('pcs_listing_price_vnd', { precision: 18, scale: 2 }),
    /** Combo / bundle flag — separates these from regular options in Product Breakdown. */
    pcsIsCombo: boolean('pcs_is_combo').notNull().default(false),
    /**
     * Optional combo metadata (Phase 1: reference only). Shape:
     *   { ownSku?: string, componentSkus?: string[] }
     * - `ownSku`: the combo's dedicated product SKU (if different from the concat-pattern code)
     * - `componentSkus`: the SKU codes of the constituent products (e.g. `['B', 'C']`)
     * Calculator does not consume this in Phase 1 — UI display + future decomposition only.
     */
    pcsComboMeta: jsonb('pcs_combo_meta'),
    pcsCreatedBy: char('pcs_created_by', { length: 36 }).notNull(),
    pcsCreatedAt: timestamp('pcs_created_at', { withTimezone: true }).defaultNow().notNull(),
    pcsUpdatedAt: timestamp('pcs_updated_at', { withTimezone: true }),
    pcsDeletedAt: timestamp('pcs_deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqEntSku: uniqueIndex('uniq_sal_pcs_ent_sku')
      .on(t.entId, t.pcsSkuCode)
      .where(sql`pcs_deleted_at IS NULL`),
    idxEntName: index('idx_sal_pcs_ent_name').on(t.entId, t.pcsProductNameVi),
  }),
);

export type SalPrimeCost = typeof salPrimeCosts.$inferSelect;
export type SalPrimeCostInsert = typeof salPrimeCosts.$inferInsert;
