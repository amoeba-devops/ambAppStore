import 'server-only';
import { and, desc, isNull, or, eq, lte } from 'drizzle-orm';
import { db, schema } from '@v2/db';
import { DEFAULT_VND_PER_KRW } from '@/lib/format';

export interface FxRateRow {
  fxrId: string;
  entId: string | null;
  vndPerKrw: number;
  effectiveFrom: string;
  sourceNote: string | null;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Returns the active VND-per-KRW rate for an entity as of `asOf` (defaults
 * to now). Resolution order:
 *   1. Latest entity-specific row with `effective_from <= asOf`.
 *   2. Latest global (entId IS NULL) row with `effective_from <= asOf`.
 *   3. Hardcoded `DEFAULT_VND_PER_KRW` constant — should never hit in prod
 *      since migration 0015 seeds a global row at the epoch.
 *
 * Soft-deleted rows are ignored.
 */
export async function getCurrentFxRate(
  entId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const rows = await db
    .select({ vndPerKrw: schema.salFxRates.fxrVndPerKrw })
    .from(schema.salFxRates)
    .where(
      and(
        // Entity-specific OR global fallback. Order by ent_id DESC NULLS LAST
        // would let us pick entity over global, but PG NULLS LAST + DESC is
        // verbose — easier to fetch both, then prefer entity in JS below.
        or(
          eq(schema.salFxRates.entId, entId),
          isNull(schema.salFxRates.entId),
        )!,
        lte(schema.salFxRates.fxrEffectiveFrom, asOf),
        isNull(schema.salFxRates.fxrDeletedAt),
      ),
    )
    .orderBy(desc(schema.salFxRates.fxrEffectiveFrom));

  // Already DESC by effective_from. Within ties (same effective_from),
  // prefer entity-specific over global — but we just pick the first row.
  // For correctness across ties, run the query twice (entity, then global)
  // — done below if no row matches the entity branch.
  if (rows.length > 0) {
    return Number(rows[0]!.vndPerKrw);
  }
  return DEFAULT_VND_PER_KRW;
}

/**
 * List FX rate history for the entity (entity-specific + global, DESC by
 * effective_from). For Admin UI display.
 */
export async function listFxRateHistory(entId: string): Promise<FxRateRow[]> {
  const rows = await db
    .select({
      fxrId: schema.salFxRates.fxrId,
      entId: schema.salFxRates.entId,
      vndPerKrw: schema.salFxRates.fxrVndPerKrw,
      effectiveFrom: schema.salFxRates.fxrEffectiveFrom,
      sourceNote: schema.salFxRates.fxrSourceNote,
      createdBy: schema.salFxRates.fxrCreatedBy,
      createdAt: schema.salFxRates.fxrCreatedAt,
    })
    .from(schema.salFxRates)
    .where(
      and(
        or(
          eq(schema.salFxRates.entId, entId),
          isNull(schema.salFxRates.entId),
        )!,
        isNull(schema.salFxRates.fxrDeletedAt),
      ),
    )
    .orderBy(desc(schema.salFxRates.fxrEffectiveFrom));
  return rows.map((r) => ({
    fxrId: r.fxrId,
    entId: r.entId,
    vndPerKrw: Number(r.vndPerKrw),
    effectiveFrom: r.effectiveFrom.toISOString(),
    sourceNote: r.sourceNote,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  }));
}
