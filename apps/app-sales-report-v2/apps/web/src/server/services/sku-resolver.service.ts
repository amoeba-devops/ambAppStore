import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';

export interface ResolvedSku {
  pcsId: string;
  entId: string;
  /** Canonical SKU code in master (may differ from the input when matched via componentSkus). */
  skuCode: string;
  matchedVia: 'direct' | 'componentSkus';
}

/**
 * Resolve a user-supplied SKU string against `sal_prime_costs`. Tries the
 * direct match first; if not found, attempts to interpret the input as an
 * underscore-joined component-SKU list and matches against the
 * `pcs_combo_meta->>'componentSkus'` jsonb array (any master row whose
 * `componentSkus` contains all parts of the input — typically used when
 * Operator pastes a concatenated component string from Shopee instead of the
 * canonical combo SKU code).
 *
 * Returns null when neither path resolves. Caller decides how to surface the
 * miss (skip, warn, error).
 *
 * Example:
 *   - input: "SAFG20U0014_SAFG20U0012_SAFG20U0013_SAFG20U0011_SAFG20U0010"
 *   - canonical SKU in master: "COMBO5_5SILICONE_HONGDAT"
 *   - master's `pcs_combo_meta.componentSkus` = ["SAFG20U0014", "SAFG20U0012", ...]
 *   - result: { skuCode: 'COMBO5_5SILICONE_HONGDAT', matchedVia: 'componentSkus' }
 */
export async function resolveSkuFlexible(
  entId: string,
  input: string,
): Promise<ResolvedSku | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Direct match on pcs_sku_code.
  const direct = await db
    .select({
      pcsId: schema.salPrimeCosts.pcsId,
      entId: schema.salPrimeCosts.entId,
      skuCode: schema.salPrimeCosts.pcsSkuCode,
    })
    .from(schema.salPrimeCosts)
    .where(
      and(
        withEnt(schema.salPrimeCosts.entId, entId),
        eq(schema.salPrimeCosts.pcsSkuCode, trimmed),
        isNull(schema.salPrimeCosts.pcsDeletedAt),
      ),
    )
    .limit(1);
  if (direct[0]) {
    return {
      pcsId: direct[0].pcsId,
      entId: direct[0].entId,
      skuCode: direct[0].skuCode,
      matchedVia: 'direct',
    };
  }

  // 2. Fallback — interpret input as underscore-joined component list.
  const parts = trimmed.split('_').filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  // Build the `?&` operator query: pcs_combo_meta->'componentSkus' must
  // contain ALL parts. Use parameterised SQL.
  const meta = await db
    .select({
      pcsId: schema.salPrimeCosts.pcsId,
      entId: schema.salPrimeCosts.entId,
      skuCode: schema.salPrimeCosts.pcsSkuCode,
    })
    .from(schema.salPrimeCosts)
    .where(
      and(
        withEnt(schema.salPrimeCosts.entId, entId),
        isNull(schema.salPrimeCosts.pcsDeletedAt),
        sql`${schema.salPrimeCosts.pcsComboMeta}->'componentSkus' ?& ${parts}::text[]`,
      ),
    )
    .limit(1);
  if (meta[0]) {
    return {
      pcsId: meta[0].pcsId,
      entId: meta[0].entId,
      skuCode: meta[0].skuCode,
      matchedVia: 'componentSkus',
    };
  }

  return null;
}

/**
 * Batch variant — resolves an array of SKU inputs in a single round-trip
 * pattern. Returns map keyed by input string → ResolvedSku or null.
 * Currently sequential (good enough for ≤ 500 entries); switch to bulk
 * queries if it becomes a bottleneck.
 */
export async function resolveSkusFlexibleBulk(
  entId: string,
  inputs: string[],
): Promise<Map<string, ResolvedSku | null>> {
  const out = new Map<string, ResolvedSku | null>();
  for (const input of inputs) {
    out.set(input, await resolveSkuFlexible(entId, input));
  }
  return out;
}
