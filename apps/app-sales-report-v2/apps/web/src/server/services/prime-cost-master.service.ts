import 'server-only';
import { and, isNull } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import type { PrimeCostMap } from './gmv-calculator.service';

/**
 * Load prime cost master for the given entity as a SKU → master map.
 * Used by Server Actions that need to join sales data with selling_price /
 * prime_cost (Total Net GMV, Total Prime Cost calculations).
 */
export async function loadPrimeCostMaster(entId: string): Promise<PrimeCostMap> {
  const rows = await db
    .select({
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

  const map: PrimeCostMap = new Map();
  for (const r of rows) {
    map.set(r.sku, {
      primeCost: Number(r.primeCost),
      sellingPrice: r.sellingPrice != null ? Number(r.sellingPrice) : 0,
      listingPrice: r.listingPrice != null ? Number(r.listingPrice) : 0,
      productNameEn: r.productNameEn ?? '',
    });
  }
  return map;
}
