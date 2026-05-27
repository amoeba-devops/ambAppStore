import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { SalError } from '@v2/shared/errors';

/**
 * CRUD for `sal_listing_price_versions`. Mirrors `selling-price-version.service.ts`.
 */

export interface ListingPriceVersionRow {
  lpvId: string;
  pcsId: string;
  effectiveFrom: string;
  listingPriceVnd: number;
  sourceNote: string | null;
  createdBy: string;
  createdAt: string;
}

export async function listListingVersionsForSku(
  entId: string,
  pcsId: string,
): Promise<ListingPriceVersionRow[]> {
  const rows = await db
    .select({
      lpvId: schema.salListingPriceVersions.lpvId,
      pcsId: schema.salListingPriceVersions.pcsId,
      effectiveFrom: schema.salListingPriceVersions.lpvEffectiveFrom,
      listingPriceVnd: schema.salListingPriceVersions.lpvListingPriceVnd,
      sourceNote: schema.salListingPriceVersions.lpvSourceNote,
      createdBy: schema.salListingPriceVersions.lpvCreatedBy,
      createdAt: schema.salListingPriceVersions.lpvCreatedAt,
    })
    .from(schema.salListingPriceVersions)
    .where(
      and(
        withEnt(schema.salListingPriceVersions.entId, entId),
        eq(schema.salListingPriceVersions.pcsId, pcsId),
        isNull(schema.salListingPriceVersions.lpvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salListingPriceVersions.lpvEffectiveFrom));

  return rows.map((r) => ({
    lpvId: r.lpvId,
    pcsId: r.pcsId,
    effectiveFrom: r.effectiveFrom,
    listingPriceVnd: Number(r.listingPriceVnd),
    sourceNote: r.sourceNote ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AddListingVersionInput {
  entId: string;
  userId: string;
  pcsId: string;
  effectiveFrom: string;
  listingPriceVnd: number;
  sourceNote?: string | null;
}

export async function addListingVersion(input: AddListingVersionInput): Promise<{ lpvId: string }> {
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
  if (input.listingPriceVnd < 0) {
    throw new SalError('SAL-E0400', 400, 'listingPriceVnd must be >= 0');
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

  const lpvId = randomUUID();
  try {
    await db.insert(schema.salListingPriceVersions).values({
      lpvId,
      entId: input.entId,
      pcsId: input.pcsId,
      lpvEffectiveFrom: input.effectiveFrom,
      lpvListingPriceVnd: String(input.listingPriceVnd),
      lpvSourceNote: input.sourceNote ?? null,
      lpvCreatedBy: input.userId,
    });
  } catch (err) {
    if (err instanceof Error && /uniq_sal_lpv_ent_sku_date/.test(err.message)) {
      throw new SalError('SAL-E0409', 409, 'A listing-price version with this effective date already exists for this SKU');
    }
    throw err;
  }

  const newer = await db
    .select({ effectiveFrom: schema.salListingPriceVersions.lpvEffectiveFrom })
    .from(schema.salListingPriceVersions)
    .where(
      and(
        withEnt(schema.salListingPriceVersions.entId, input.entId),
        eq(schema.salListingPriceVersions.pcsId, input.pcsId),
        isNull(schema.salListingPriceVersions.lpvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salListingPriceVersions.lpvEffectiveFrom))
    .limit(1);

  if (newer[0]?.effectiveFrom === input.effectiveFrom) {
    await db
      .update(schema.salPrimeCosts)
      .set({
        pcsListingPriceVnd: String(input.listingPriceVnd),
        pcsUpdatedAt: new Date(),
      })
      .where(eq(schema.salPrimeCosts.pcsId, input.pcsId));
  }

  return { lpvId };
}

export async function softDeleteListingVersion(
  entId: string,
  lpvId: string,
): Promise<{ pcsId: string }> {
  const target = await db
    .select({
      lpvId: schema.salListingPriceVersions.lpvId,
      pcsId: schema.salListingPriceVersions.pcsId,
    })
    .from(schema.salListingPriceVersions)
    .where(
      and(
        withEnt(schema.salListingPriceVersions.entId, entId),
        eq(schema.salListingPriceVersions.lpvId, lpvId),
        isNull(schema.salListingPriceVersions.lpvDeletedAt),
      ),
    )
    .limit(1);
  if (target.length === 0) {
    throw new SalError('SAL-E0404', 404, 'Listing-price version not found');
  }
  const { pcsId } = target[0]!;

  const activeCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.salListingPriceVersions)
    .where(
      and(
        withEnt(schema.salListingPriceVersions.entId, entId),
        eq(schema.salListingPriceVersions.pcsId, pcsId),
        isNull(schema.salListingPriceVersions.lpvDeletedAt),
      ),
    );
  if ((activeCount[0]?.c ?? 0) <= 1) {
    throw new SalError(
      'SAL-E0409',
      409,
      'Cannot delete the only active listing-price version. Add a replacement first.',
    );
  }

  await db
    .update(schema.salListingPriceVersions)
    .set({ lpvDeletedAt: new Date() })
    .where(eq(schema.salListingPriceVersions.lpvId, lpvId));

  const newLatest = await db
    .select({ value: schema.salListingPriceVersions.lpvListingPriceVnd })
    .from(schema.salListingPriceVersions)
    .where(
      and(
        withEnt(schema.salListingPriceVersions.entId, entId),
        eq(schema.salListingPriceVersions.pcsId, pcsId),
        isNull(schema.salListingPriceVersions.lpvDeletedAt),
      ),
    )
    .orderBy(desc(schema.salListingPriceVersions.lpvEffectiveFrom))
    .limit(1);
  if (newLatest[0]) {
    await db
      .update(schema.salPrimeCosts)
      .set({
        pcsListingPriceVnd: newLatest[0].value,
        pcsUpdatedAt: new Date(),
      })
      .where(eq(schema.salPrimeCosts.pcsId, pcsId));
  }

  return { pcsId };
}
