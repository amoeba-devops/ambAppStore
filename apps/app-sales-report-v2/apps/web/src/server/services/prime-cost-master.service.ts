import 'server-only';
import { and, desc, isNull } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import type {
  PrimeCostMap,
  PrimeCostMaster,
  PrimeCostVersion,
} from './gmv-calculator.service';

/**
 * Load prime cost master for the given entity as a SKU → master map.
 *
 * Each master row carries a `versions[]` array (DESC by `effectiveFrom`).
 * Calculator picks the version active at the order's createDate via
 * `findPrimeCost`. SKUs without any version row get a synthesized
 * 1900-01-01 fallback from `pcs_prime_cost_vnd` so calculator code stays
 * uniform.
 *
 * Used by Server Actions that need to join sales data with selling_price /
 * prime_cost (Total Net GMV, Total Prime Cost calculations).
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
    })
    .from(schema.salPrimeCosts)
    .where(
      and(withEnt(schema.salPrimeCosts.entId, entId), isNull(schema.salPrimeCosts.pcsDeletedAt)),
    );

  const versionsByPcsId = new Map<string, PrimeCostVersion[]>();
  const versionRows = await db
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
    .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom));

  for (const v of versionRows) {
    const arr = versionsByPcsId.get(v.pcsId) ?? [];
    arr.push({
      effectiveFrom: v.effectiveFrom,
      primeCost: Number(v.primeCost),
      breakdown: (v.breakdown as Record<string, unknown> | null) ?? null,
    });
    versionsByPcsId.set(v.pcsId, arr);
  }

  const map: PrimeCostMap = new Map();
  for (const r of masters) {
    const flatCost = Number(r.primeCost);
    const versions =
      versionsByPcsId.get(r.pcsId) ??
      // Flag off OR master row without any version → synthesize one. Empty
      // effectiveFrom date means "applicable forever in the past".
      ([
        { effectiveFrom: '1900-01-01', primeCost: flatCost, breakdown: null },
      ] satisfies PrimeCostVersion[]);

    const latest = versions[0]?.primeCost ?? flatCost;
    const master: PrimeCostMaster = {
      primeCost: latest, // backward-compat: latest effective cost
      sellingPrice: r.sellingPrice != null ? Number(r.sellingPrice) : 0,
      listingPrice: r.listingPrice != null ? Number(r.listingPrice) : 0,
      productNameEn: r.productNameEn ?? '',
      versions,
    };
    map.set(r.sku, master);
  }
  return map;
}
