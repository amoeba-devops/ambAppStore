import 'server-only';
import { and, desc, isNull } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import type {
  PrimeCostMap,
  PrimeCostMaster,
  PrimeCostVersion,
  PriceVersion,
} from './gmv-calculator.service';

/**
 * Load prime cost master for the given entity as a SKU → master map.
 *
 * Each master row carries 3 version arrays (each DESC by `effectiveFrom`):
 *   - `versions`        — prime cost
 *   - `sellingVersions` — selling price (Shopee Net GMV)
 *   - `listingVersions` — listing price (TikTok GMV)
 *
 * Calculators pick the version active at the order's createDate via
 * `findPrimeCost` / `findSellingPrice` / `findListingPrice`. SKUs without any
 * prime version row get a synthesized 1900-01-01 fallback from
 * `pcs_prime_cost_vnd` so calculator code stays uniform.
 */
export async function loadPrimeCostMaster(entId: string): Promise<PrimeCostMap> {
  const masters = await db
    .select({
      pcsId: schema.salPrimeCosts.pcsId,
      sku: schema.salPrimeCosts.pcsSkuCode,
      primeCost: schema.salPrimeCosts.pcsPrimeCostVnd,
      sellingPrice: schema.salPrimeCosts.pcsSellingPriceVnd,
      listingPrice: schema.salPrimeCosts.pcsListingPriceVnd,
      productNameEn: schema.salPrimeCosts.pcsProductNameEn,
      variationName: schema.salPrimeCosts.pcsVariationName,
      isCombo: schema.salPrimeCosts.pcsIsCombo,
      comboMeta: schema.salPrimeCosts.pcsComboMeta,
    })
    .from(schema.salPrimeCosts)
    .where(
      and(withEnt(schema.salPrimeCosts.entId, entId), isNull(schema.salPrimeCosts.pcsDeletedAt)),
    );

  // 3 parallel queries for the version tables. All entity-scoped + soft-deletion aware.
  const [primeRows, sellingRows, listingRows] = await Promise.all([
    db
      .select({
        pcsId: schema.salPrimeCostVersions.pcsId,
        effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom,
        primeCost: schema.salPrimeCostVersions.pcvPrimeCostVnd,
        breakdown: schema.salPrimeCostVersions.pcvBreakdown,
      })
      .from(schema.salPrimeCostVersions)
      .where(
        and(
          withEnt(schema.salPrimeCostVersions.entId, entId),
          isNull(schema.salPrimeCostVersions.pcvDeletedAt),
        ),
      )
      .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom)),
    db
      .select({
        pcsId: schema.salSellingPriceVersions.pcsId,
        effectiveFrom: schema.salSellingPriceVersions.spvEffectiveFrom,
        valueVnd: schema.salSellingPriceVersions.spvSellingPriceVnd,
      })
      .from(schema.salSellingPriceVersions)
      .where(
        and(
          withEnt(schema.salSellingPriceVersions.entId, entId),
          isNull(schema.salSellingPriceVersions.spvDeletedAt),
        ),
      )
      .orderBy(desc(schema.salSellingPriceVersions.spvEffectiveFrom)),
    db
      .select({
        pcsId: schema.salListingPriceVersions.pcsId,
        effectiveFrom: schema.salListingPriceVersions.lpvEffectiveFrom,
        valueVnd: schema.salListingPriceVersions.lpvListingPriceVnd,
      })
      .from(schema.salListingPriceVersions)
      .where(
        and(
          withEnt(schema.salListingPriceVersions.entId, entId),
          isNull(schema.salListingPriceVersions.lpvDeletedAt),
        ),
      )
      .orderBy(desc(schema.salListingPriceVersions.lpvEffectiveFrom)),
  ]);

  const primeByPcsId = new Map<string, PrimeCostVersion[]>();
  for (const v of primeRows) {
    const arr = primeByPcsId.get(v.pcsId) ?? [];
    arr.push({
      effectiveFrom: v.effectiveFrom,
      primeCost: Number(v.primeCost),
      breakdown: (v.breakdown as Record<string, unknown> | null) ?? null,
    });
    primeByPcsId.set(v.pcsId, arr);
  }

  const sellingByPcsId = new Map<string, PriceVersion[]>();
  for (const v of sellingRows) {
    const arr = sellingByPcsId.get(v.pcsId) ?? [];
    arr.push({ effectiveFrom: v.effectiveFrom, valueVnd: Number(v.valueVnd) });
    sellingByPcsId.set(v.pcsId, arr);
  }

  const listingByPcsId = new Map<string, PriceVersion[]>();
  for (const v of listingRows) {
    const arr = listingByPcsId.get(v.pcsId) ?? [];
    arr.push({ effectiveFrom: v.effectiveFrom, valueVnd: Number(v.valueVnd) });
    listingByPcsId.set(v.pcsId, arr);
  }

  // Alias map: when a master row carries `pcs_combo_meta.componentSkus`, we
  // also register the joined "A_B_C..." string as an alias key pointing to
  // the same master. This lets the calculator resolve a Shopee `varSku` that
  // looks like a concatenated component-SKU list (a common Shopee combo
  // naming convention) → the canonical combo master. Direct SKU match always
  // wins; aliases only fill in when no direct match exists.
  const pendingAliases: Array<{ key: string; master: PrimeCostMaster }> = [];

  const map: PrimeCostMap = new Map();
  for (const r of masters) {
    const flatCost = Number(r.primeCost);
    const flatSelling = r.sellingPrice != null ? Number(r.sellingPrice) : 0;
    const flatListing = r.listingPrice != null ? Number(r.listingPrice) : 0;
    const versions =
      primeByPcsId.get(r.pcsId) ??
      // Master row without any version → synthesize one so calculator code can scan uniformly.
      ([
        { effectiveFrom: '1900-01-01', primeCost: flatCost, breakdown: null },
      ] satisfies PrimeCostVersion[]);
    const sellingVersions = sellingByPcsId.get(r.pcsId) ?? [];
    const listingVersions = listingByPcsId.get(r.pcsId) ?? [];

    const master: PrimeCostMaster = {
      // Latest effective values cached for UI consumers that don't care about per-order pricing.
      primeCost: versions[0]?.primeCost ?? flatCost,
      sellingPrice: sellingVersions[0]?.valueVnd ?? flatSelling,
      listingPrice: listingVersions[0]?.valueVnd ?? flatListing,
      productNameEn: r.productNameEn ?? '',
      variationName: r.variationName ?? '',
      isCombo: r.isCombo,
      versions,
      sellingVersions,
      listingVersions,
    };
    map.set(r.sku, master);

    // Queue componentSkus alias (resolves Shopee combo varSku like
    // `A_B_C_D_E` → the canonical master that owns those components).
    const meta = r.comboMeta as { componentSkus?: string[] } | null;
    const components = meta?.componentSkus;
    if (Array.isArray(components) && components.length > 0) {
      pendingAliases.push({ key: components.join('_'), master });
    }
  }

  // Apply aliases AFTER all direct SKUs are in place. Skip when a direct entry
  // (or an earlier alias) already claims the same key — direct match always wins.
  for (const { key, master } of pendingAliases) {
    if (!map.has(key)) map.set(key, master);
  }

  return map;
}
