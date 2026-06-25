import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { SalError } from '@v2/shared/errors';

/**
 * CRUD for `sal_prime_cost_versions`. See REQ-20260521-prime-cost-versioning.
 *
 * Returned rows in `listVersionsForSku` are sorted DESC by `effectiveFrom`
 * (matches the loader's expectation in `prime-cost-master.service.ts`).
 */

export interface PrimeCostVersionRow {
  pcvId: string;
  pcsId: string;
  effectiveFrom: string;
  primeCostVnd: number;
  breakdown: Record<string, unknown> | null;
  sourceNote: string | null;
  createdBy: string;
  createdAt: string;
}

export async function listVersionsForSku(
  entId: string,
  pcsId: string,
): Promise<PrimeCostVersionRow[]> {
  const rows = await db
    .select({
      pcvId: schema.salPrimeCostVersions.pcvId,
      pcsId: schema.salPrimeCostVersions.pcsId,
      effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom,
      primeCostVnd: schema.salPrimeCostVersions.pcvPrimeCostVnd,
      breakdown: schema.salPrimeCostVersions.pcvBreakdown,
      sourceNote: schema.salPrimeCostVersions.pcvSourceNote,
      createdBy: schema.salPrimeCostVersions.pcvCreatedBy,
      createdAt: schema.salPrimeCostVersions.pcvCreatedAt,
    })
    .from(schema.salPrimeCostVersions)
    .where(
      and(
        withEnt(schema.salPrimeCostVersions.entId, entId),
        eq(schema.salPrimeCostVersions.pcsId, pcsId),
        isNull(schema.salPrimeCostVersions.pcvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom));

  return rows.map((r) => ({
    pcvId: r.pcvId,
    pcsId: r.pcsId,
    effectiveFrom: r.effectiveFrom,
    primeCostVnd: Number(r.primeCostVnd),
    breakdown: (r.breakdown as Record<string, unknown> | null) ?? null,
    sourceNote: r.sourceNote ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AddVersionInput {
  entId: string;
  userId: string;
  pcsId: string;
  effectiveFrom: string; // ISO YYYY-MM-DD
  primeCostVnd: number;
  breakdown?: Record<string, unknown> | null;
  sourceNote?: string | null;
}

/**
 * Insert a new prime-cost version. Also syncs `sal_prime_costs.pcs_prime_cost_vnd`
 * to the new value when this version is the latest effective among current ones
 * — keeps the denormalized "latest cost" cache truthful for UI consumers that
 * read the master row directly.
 *
 * Rejects:
 * - `effectiveFrom` is more than 30 days in the future (safety guard)
 * - Duplicate (ent, sku, effectiveFrom) — caller should surface the conflict
 *   (unique index will raise DB-side error → SalError SAL-E0409).
 * - SKU does not belong to the entity or is soft-deleted
 */
export async function addVersion(input: AddVersionInput): Promise<{ pcvId: string }> {
  // Cap future-effective to +30 days (REQ + TC-4.3)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eff = new Date(`${input.effectiveFrom}T00:00:00`);
  if (Number.isNaN(eff.getTime())) {
    throw new SalError('SAL-E0400', 400, 'Invalid effectiveFrom date');
  }
  const maxFuture = new Date(today.getTime() + 30 * 86400_000);
  if (eff > maxFuture) {
    throw new SalError('SAL-E0400', 400, 'effectiveFrom is more than 30 days in the future');
  }
  if (input.primeCostVnd < 0) {
    throw new SalError('SAL-E0400', 400, 'primeCostVnd must be >= 0');
  }

  // Verify SKU ownership
  const sku = await db
    .select({ pcsId: schema.salPrimeCosts.pcsId })
    .from(schema.salPrimeCosts)
    .where(
      and(
        withEnt(schema.salPrimeCosts.entId, input.entId),
        eq(schema.salPrimeCosts.pcsId, input.pcsId),
        isNull(schema.salPrimeCosts.pcsDeletedAt),
      ),
    )
    .limit(1);
  if (sku.length === 0) {
    throw new SalError('SAL-E0404', 404, 'SKU not found');
  }

  const pcvId = randomUUID();
  try {
    await db.insert(schema.salPrimeCostVersions).values({
      pcvId,
      entId: input.entId,
      pcsId: input.pcsId,
      pcvEffectiveFrom: input.effectiveFrom,
      pcvPrimeCostVnd: String(input.primeCostVnd),
      pcvBreakdown: input.breakdown ?? null,
      pcvSourceNote: input.sourceNote ?? null,
      pcvCreatedBy: input.userId,
    });
  } catch (err) {
    if (err instanceof Error && /uniq_sal_pcv_ent_sku_date/.test(err.message)) {
      throw new SalError('SAL-E0409', 409, 'A version with this effective date already exists for this SKU');
    }
    throw err;
  }

  // Sync master cache when the new version is the latest effective. We compare
  // against the most-recent existing version's effectiveFrom; if new ≥ that
  // (or no other versions exist), update the flat cache + bump pcs_updated_at.
  const newer = await db
    .select({ effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom })
    .from(schema.salPrimeCostVersions)
    .where(
      and(
        withEnt(schema.salPrimeCostVersions.entId, input.entId),
        eq(schema.salPrimeCostVersions.pcsId, input.pcsId),
        isNull(schema.salPrimeCostVersions.pcvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom))
    .limit(1);

  if (newer[0]?.effectiveFrom === input.effectiveFrom) {
    await db
      .update(schema.salPrimeCosts)
      .set({
        pcsPrimeCostVnd: String(input.primeCostVnd),
        pcsUpdatedAt: new Date(),
      })
      .where(eq(schema.salPrimeCosts.pcsId, input.pcsId));
  }

  return { pcvId };
}

/**
 * Soft-delete a version. Rejects if it would leave the SKU with zero active
 * versions. If the deleted version was the latest, master cache is re-synced
 * to whatever remains as latest.
 */
export async function softDeleteVersion(
  entId: string,
  pcvId: string,
): Promise<{ pcsId: string }> {
  const target = await db
    .select({
      pcvId: schema.salPrimeCostVersions.pcvId,
      pcsId: schema.salPrimeCostVersions.pcsId,
      effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom,
    })
    .from(schema.salPrimeCostVersions)
    .where(
      and(
        withEnt(schema.salPrimeCostVersions.entId, entId),
        eq(schema.salPrimeCostVersions.pcvId, pcvId),
        isNull(schema.salPrimeCostVersions.pcvDeletedAt),
      ),
    )
    .limit(1);
  if (target.length === 0) {
    throw new SalError('SAL-E0404', 404, 'Version not found');
  }
  const { pcsId } = target[0]!;

  const activeCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.salPrimeCostVersions)
    .where(
      and(
        withEnt(schema.salPrimeCostVersions.entId, entId),
        eq(schema.salPrimeCostVersions.pcsId, pcsId),
        isNull(schema.salPrimeCostVersions.pcvDeletedAt),
      ),
    );
  if ((activeCount[0]?.c ?? 0) <= 1) {
    throw new SalError(
      'SAL-E0409',
      409,
      'Cannot delete the only active version of a SKU. Add a replacement first.',
    );
  }

  await db
    .update(schema.salPrimeCostVersions)
    .set({ pcvDeletedAt: new Date() })
    .where(eq(schema.salPrimeCostVersions.pcvId, pcvId));

  // Re-sync master cache to the new latest version's cost
  const newLatest = await db
    .select({ primeCost: schema.salPrimeCostVersions.pcvPrimeCostVnd })
    .from(schema.salPrimeCostVersions)
    .where(
      and(
        withEnt(schema.salPrimeCostVersions.entId, entId),
        eq(schema.salPrimeCostVersions.pcsId, pcsId),
        isNull(schema.salPrimeCostVersions.pcvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom))
    .limit(1);
  if (newLatest[0]) {
    await db
      .update(schema.salPrimeCosts)
      .set({
        pcsPrimeCostVnd: newLatest[0].primeCost,
        pcsUpdatedAt: new Date(),
      })
      .where(eq(schema.salPrimeCosts.pcsId, pcsId));
  }

  return { pcsId };
}
