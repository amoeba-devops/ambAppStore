import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { SalError } from '@v2/shared/errors';

/**
 * CRUD for `sal_selling_price_versions`. Mirrors `prime-cost-version.service.ts`
 * — see REQ-20260526-price-versioning.
 */

export interface SellingPriceVersionRow {
  spvId: string;
  pcsId: string;
  effectiveFrom: string;
  sellingPriceVnd: number;
  sourceNote: string | null;
  createdBy: string;
  createdAt: string;
}

export async function listSellingVersionsForSku(
  entId: string,
  pcsId: string,
): Promise<SellingPriceVersionRow[]> {
  const rows = await db
    .select({
      spvId: schema.salSellingPriceVersions.spvId,
      pcsId: schema.salSellingPriceVersions.pcsId,
      effectiveFrom: schema.salSellingPriceVersions.spvEffectiveFrom,
      sellingPriceVnd: schema.salSellingPriceVersions.spvSellingPriceVnd,
      sourceNote: schema.salSellingPriceVersions.spvSourceNote,
      createdBy: schema.salSellingPriceVersions.spvCreatedBy,
      createdAt: schema.salSellingPriceVersions.spvCreatedAt,
    })
    .from(schema.salSellingPriceVersions)
    .where(
      and(
        withEnt(schema.salSellingPriceVersions.entId, entId),
        eq(schema.salSellingPriceVersions.pcsId, pcsId),
        isNull(schema.salSellingPriceVersions.spvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salSellingPriceVersions.spvEffectiveFrom));

  return rows.map((r) => ({
    spvId: r.spvId,
    pcsId: r.pcsId,
    effectiveFrom: r.effectiveFrom,
    sellingPriceVnd: Number(r.sellingPriceVnd),
    sourceNote: r.sourceNote ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AddSellingVersionInput {
  entId: string;
  userId: string;
  pcsId: string;
  effectiveFrom: string;
  sellingPriceVnd: number;
  sourceNote?: string | null;
}

export async function addSellingVersion(input: AddSellingVersionInput): Promise<{ spvId: string }> {
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
  if (input.sellingPriceVnd < 0) {
    throw new SalError('SAL-E0400', 400, 'sellingPriceVnd must be >= 0');
  }

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

  const spvId = randomUUID();
  try {
    await db.insert(schema.salSellingPriceVersions).values({
      spvId,
      entId: input.entId,
      pcsId: input.pcsId,
      spvEffectiveFrom: input.effectiveFrom,
      spvSellingPriceVnd: String(input.sellingPriceVnd),
      spvSourceNote: input.sourceNote ?? null,
      spvCreatedBy: input.userId,
    });
  } catch (err) {
    if (err instanceof Error && /uniq_sal_spv_ent_sku_date/.test(err.message)) {
      throw new SalError('SAL-E0409', 409, 'A selling-price version with this effective date already exists for this SKU');
    }
    throw err;
  }

  // Sync master cache when new version is the latest.
  const newer = await db
    .select({ effectiveFrom: schema.salSellingPriceVersions.spvEffectiveFrom })
    .from(schema.salSellingPriceVersions)
    .where(
      and(
        withEnt(schema.salSellingPriceVersions.entId, input.entId),
        eq(schema.salSellingPriceVersions.pcsId, input.pcsId),
        isNull(schema.salSellingPriceVersions.spvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salSellingPriceVersions.spvEffectiveFrom))
    .limit(1);

  if (newer[0]?.effectiveFrom === input.effectiveFrom) {
    await db
      .update(schema.salPrimeCosts)
      .set({
        pcsSellingPriceVnd: String(input.sellingPriceVnd),
        pcsUpdatedAt: new Date(),
      })
      .where(eq(schema.salPrimeCosts.pcsId, input.pcsId));
  }

  return { spvId };
}

export async function softDeleteSellingVersion(
  entId: string,
  spvId: string,
): Promise<{ pcsId: string }> {
  const target = await db
    .select({
      spvId: schema.salSellingPriceVersions.spvId,
      pcsId: schema.salSellingPriceVersions.pcsId,
    })
    .from(schema.salSellingPriceVersions)
    .where(
      and(
        withEnt(schema.salSellingPriceVersions.entId, entId),
        eq(schema.salSellingPriceVersions.spvId, spvId),
        isNull(schema.salSellingPriceVersions.spvDeletedAt),
      ),
    )
    .limit(1);
  if (target.length === 0) {
    throw new SalError('SAL-E0404', 404, 'Selling-price version not found');
  }
  const { pcsId } = target[0]!;

  const activeCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.salSellingPriceVersions)
    .where(
      and(
        withEnt(schema.salSellingPriceVersions.entId, entId),
        eq(schema.salSellingPriceVersions.pcsId, pcsId),
        isNull(schema.salSellingPriceVersions.spvDeletedAt),
      ),
    );
  if ((activeCount[0]?.c ?? 0) <= 1) {
    throw new SalError(
      'SAL-E0409',
      409,
      'Cannot delete the only active selling-price version. Add a replacement first.',
    );
  }

  await db
    .update(schema.salSellingPriceVersions)
    .set({ spvDeletedAt: new Date() })
    .where(eq(schema.salSellingPriceVersions.spvId, spvId));

  const newLatest = await db
    .select({ value: schema.salSellingPriceVersions.spvSellingPriceVnd })
    .from(schema.salSellingPriceVersions)
    .where(
      and(
        withEnt(schema.salSellingPriceVersions.entId, entId),
        eq(schema.salSellingPriceVersions.pcsId, pcsId),
        isNull(schema.salSellingPriceVersions.spvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salSellingPriceVersions.spvEffectiveFrom))
    .limit(1);
  if (newLatest[0]) {
    await db
      .update(schema.salPrimeCosts)
      .set({
        pcsSellingPriceVnd: newLatest[0].value,
        pcsUpdatedAt: new Date(),
      })
      .where(eq(schema.salPrimeCosts.pcsId, pcsId));
  }

  return { pcsId };
}
