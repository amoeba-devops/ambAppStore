'use server';

import 'server-only';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema, withEnt } from '@v2/db';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { buildCsv, parseCsv } from '@/lib/csv';
import {
  buildColumnIndex,
  cell,
  detectHeader,
  looksLikeScientificNotation,
  parseBool,
  parseFlexibleDate,
  parseNumericLoose,
  stripExcelTextWrapper,
} from '@/lib/csv-import';
import { logAction } from '@/server/services/action-log.service';
import {
  addVersion,
  listVersionsForSku,
  softDeleteVersion,
} from '@/server/services/prime-cost-version.service';
import {
  addSellingVersion,
  listSellingVersionsForSku,
  softDeleteSellingVersion,
} from '@/server/services/selling-price-version.service';
import {
  addListingVersion,
  listListingVersionsForSku,
  softDeleteListingVersion,
} from '@/server/services/listing-price-version.service';

const SOFT_DELETED = isNull(schema.salPrimeCosts.pcsDeletedAt);

/**
 * Invalidates the server-rendered output of all 4 RFR Data routes so that
 * the next navigation / `router.refresh()` returns fresh data. Call from
 * every mutation action that touches `sal_prime_costs` or any of the 3
 * version tables. Companion to the BroadcastChannel publish on the client
 * (see `lib/data-revalidation.ts`) — that handles other open tabs.
 */
function revalidateCostMaster(): void {
  revalidatePath('/cost-master/products');
  revalidatePath('/cost-master/prime-cost');
  revalidatePath('/cost-master/selling-price');
  revalidatePath('/cost-master/listing-price');
}

const comboMetaSchema = z
  .object({
    componentSkus: z.array(z.string().max(128)).max(20).optional(),
  })
  .nullable()
  .optional();

const rowSchema = z.object({
  productId: z.string().max(64).optional().nullable(),
  variationId: z.string().max(64).optional().nullable(),
  variationName: z.string().max(255).optional().nullable(),
  productNameVi: z.string().min(1).max(512),
  productNameEn: z.string().max(512).optional().nullable(),
  skuCode: z.string().min(1).max(128),
  /** Free-text — EAN/UPC barcode. */
  gtin: z.string().max(64).optional().nullable(),
  /** Free-text — HS Code for customs declaration. */
  hsCode: z.string().max(32).optional().nullable(),
  primeCostVnd: z.number().nonnegative(),
  sellingPriceVnd: z.number().nonnegative().optional().nullable(),
  listingPriceVnd: z.number().nonnegative().optional().nullable(),
  isCombo: z.boolean().optional(),
  comboMeta: comboMetaSchema,
});

export interface ComboMeta {
  componentSkus?: string[];
}

export interface VersionMeta {
  latest: string | null;
  count: number;
}

export type PrimeCostRow = {
  pcsId: string;
  productId: string | null;
  variationId: string | null;
  variationName: string | null;
  productNameVi: string;
  productNameEn: string | null;
  skuCode: string;
  /** EAN/UPC barcode — for Product List page export. */
  gtin: string | null;
  /** HS Code for customs declaration — for Product List page export. */
  hsCode: string | null;
  primeCostVnd: number;
  sellingPriceVnd: number | null;
  listingPriceVnd: number | null;
  isCombo: boolean;
  comboMeta: ComboMeta | null;
  updatedAt: string | null;
  /** Effective-from + active count for prime-cost versions. */
  effectiveFromLatest: string | null;
  versionCount: number;
  /** Effective-from + active count for selling-price versions (Phase 1.2). */
  sellingEffectiveFromLatest: string | null;
  sellingVersionCount: number;
  /** Effective-from + active count for listing-price versions (Phase 1.2). */
  listingEffectiveFromLatest: string | null;
  listingVersionCount: number;
  /**
   * Most recent version event across prime/selling/listing — for Product List
   * page's "Last Updated / Source-Note / Updated By" columns. Looks at
   * version.createdAt across all 3 version tables and picks the latest.
   */
  latestEventAt: string | null;
  latestEventNote: string | null;
  /** Display name (or email/id fallback) of the user who created the latest version. */
  latestEventBy: string | null;
};

interface RowVersionMeta {
  prime?: VersionMeta;
  selling?: VersionMeta;
  listing?: VersionMeta;
  /** Latest version row across all 3 price tables. */
  latestEvent?: { createdAt: string; sourceNote: string | null; createdBy: string | null };
  /** Map of userId → display name (for resolving createdBy). */
  userNames?: Map<string, string>;
}

function rowFromDb(
  r: typeof schema.salPrimeCosts.$inferSelect,
  meta?: RowVersionMeta,
): PrimeCostRow {
  return {
    pcsId: r.pcsId,
    productId: r.pcsProductId,
    variationId: r.pcsVariationId,
    variationName: r.pcsVariationName,
    productNameVi: r.pcsProductNameVi,
    productNameEn: r.pcsProductNameEn,
    skuCode: r.pcsSkuCode,
    gtin: r.pcsGtin,
    hsCode: r.pcsHsCode,
    primeCostVnd: Number(r.pcsPrimeCostVnd),
    sellingPriceVnd: r.pcsSellingPriceVnd != null ? Number(r.pcsSellingPriceVnd) : null,
    listingPriceVnd: r.pcsListingPriceVnd != null ? Number(r.pcsListingPriceVnd) : null,
    isCombo: r.pcsIsCombo,
    comboMeta: (r.pcsComboMeta as ComboMeta | null) ?? null,
    updatedAt: (r.pcsUpdatedAt ?? r.pcsCreatedAt).toISOString(),
    effectiveFromLatest: meta?.prime?.latest ?? null,
    versionCount: meta?.prime?.count ?? 0,
    sellingEffectiveFromLatest: meta?.selling?.latest ?? null,
    sellingVersionCount: meta?.selling?.count ?? 0,
    listingEffectiveFromLatest: meta?.listing?.latest ?? null,
    listingVersionCount: meta?.listing?.count ?? 0,
    latestEventAt: meta?.latestEvent?.createdAt ?? null,
    latestEventNote: meta?.latestEvent?.sourceNote ?? null,
    latestEventBy:
      meta?.latestEvent?.createdBy != null
        ? (meta.userNames?.get(meta.latestEvent.createdBy) ??
          // Unknown user (left org, or AMA id never synced) — show short
          // prefix instead of leaking the full UUID into the UI.
          meta.latestEvent.createdBy.slice(0, 8))
        : null,
  };
}

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof z.ZodError) {
      return { success: false, error: { code: 'SAL-E0400', message: err.errors.map((e) => e.message).join(', ') } };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key') || msg.includes('uniq_sal_pcs_ent_sku')) {
      return { success: false, error: { code: 'SAL-E0050', message: 'SKU already exists' } };
    }
    console.error('[prime-cost.action]', err);
    return { success: false, error: { code: 'SAL-E0500', message: 'Internal error' } };
  }
}

export async function listPrimeCostsAction(input: { search?: string; limit?: number } = {}) {
  return wrap(async () => {
    const user = await getCurrentUser();
    const search = input.search?.trim();
    const conditions = [withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED];
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(schema.salPrimeCosts.pcsProductNameVi, pattern),
          ilike(schema.salPrimeCosts.pcsProductNameEn, pattern),
          ilike(schema.salPrimeCosts.pcsSkuCode, pattern),
        )!,
      );
    }
    const rows = await db
      .select()
      .from(schema.salPrimeCosts)
      .where(and(...conditions))
      .orderBy(asc(schema.salPrimeCosts.pcsProductNameVi))
      .limit(input.limit ?? 500);

    const totalRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.salPrimeCosts)
      .where(and(withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED));

    // Fetch version metadata for all 3 price fields in parallel.
    // Each select also returns createdAt + sourceNote so we can compute the
    // "latest event across all 3" for the Product List page's
    // Last Updated / Source-Note column.
    const [primeRows, sellingRows, listingRows] = await Promise.all([
      db
        .select({
          pcsId: schema.salPrimeCostVersions.pcsId,
          effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom,
          createdAt: schema.salPrimeCostVersions.pcvCreatedAt,
          sourceNote: schema.salPrimeCostVersions.pcvSourceNote,
          createdBy: schema.salPrimeCostVersions.pcvCreatedBy,
        })
        .from(schema.salPrimeCostVersions)
        .where(
          and(
            withEnt(schema.salPrimeCostVersions.entId, user.entId),
            isNull(schema.salPrimeCostVersions.pcvDeletedAt),
          ),
        )
        .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom)),
      db
        .select({
          pcsId: schema.salSellingPriceVersions.pcsId,
          effectiveFrom: schema.salSellingPriceVersions.spvEffectiveFrom,
          createdAt: schema.salSellingPriceVersions.spvCreatedAt,
          sourceNote: schema.salSellingPriceVersions.spvSourceNote,
          createdBy: schema.salSellingPriceVersions.spvCreatedBy,
        })
        .from(schema.salSellingPriceVersions)
        .where(
          and(
            withEnt(schema.salSellingPriceVersions.entId, user.entId),
            isNull(schema.salSellingPriceVersions.spvDeletedAt),
          ),
        )
        .orderBy(desc(schema.salSellingPriceVersions.spvEffectiveFrom)),
      db
        .select({
          pcsId: schema.salListingPriceVersions.pcsId,
          effectiveFrom: schema.salListingPriceVersions.lpvEffectiveFrom,
          createdAt: schema.salListingPriceVersions.lpvCreatedAt,
          sourceNote: schema.salListingPriceVersions.lpvSourceNote,
          createdBy: schema.salListingPriceVersions.lpvCreatedBy,
        })
        .from(schema.salListingPriceVersions)
        .where(
          and(
            withEnt(schema.salListingPriceVersions.entId, user.entId),
            isNull(schema.salListingPriceVersions.lpvDeletedAt),
          ),
        )
        .orderBy(desc(schema.salListingPriceVersions.lpvEffectiveFrom)),
    ]);

    const collectMeta = (
      rows: Array<{ pcsId: string; effectiveFrom: string }>,
    ): Map<string, VersionMeta> => {
      const map = new Map<string, VersionMeta>();
      for (const v of rows) {
        const m = map.get(v.pcsId);
        if (!m) map.set(v.pcsId, { latest: v.effectiveFrom, count: 1 });
        else m.count += 1;
      }
      return map;
    };
    const primeMeta = collectMeta(primeRows);
    const sellingMeta = collectMeta(sellingRows);
    const listingMeta = collectMeta(listingRows);

    // Latest event = most recent createdAt across all 3 version tables for
    // each SKU. Used by Product List page to show "last touched" timestamp,
    // source-note, AND updated-by columns.
    const latestEvent = new Map<
      string,
      { createdAt: string; sourceNote: string | null; createdBy: string | null }
    >();
    const consider = (
      pcsId: string,
      createdAt: Date,
      sourceNote: string | null,
      createdBy: string | null,
    ) => {
      const cur = latestEvent.get(pcsId);
      const iso = createdAt.toISOString();
      if (!cur || iso > cur.createdAt) {
        latestEvent.set(pcsId, { createdAt: iso, sourceNote, createdBy });
      }
    };
    for (const v of primeRows) consider(v.pcsId, v.createdAt, v.sourceNote, v.createdBy);
    for (const v of sellingRows) consider(v.pcsId, v.createdAt, v.sourceNote, v.createdBy);
    for (const v of listingRows) consider(v.pcsId, v.createdAt, v.sourceNote, v.createdBy);

    // Batch-resolve userId → display name for the createdBy column.
    // version.createdBy stores the AMA user ID (not the local sal_users.usrId)
    // since auth is passthrough — look up by `usrAmaUserId`. Falls back to
    // local part of email, then a short UUID prefix, if no name is on file.
    const userIds = Array.from(
      new Set(
        [...latestEvent.values()]
          .map((e) => e.createdBy)
          .filter((id): id is string => id != null),
      ),
    );
    const userNames = new Map<string, string>();
    if (userIds.length > 0) {
      const userRows = await db
        .select({
          amaUserId: schema.salUsers.usrAmaUserId,
          usrName: schema.salUsers.usrName,
          usrEmail: schema.salUsers.usrEmail,
        })
        .from(schema.salUsers)
        .where(inArray(schema.salUsers.usrAmaUserId, userIds));
      for (const u of userRows) {
        const emailLocal = u.usrEmail?.split('@')[0] ?? null;
        userNames.set(u.amaUserId, u.usrName ?? emailLocal ?? u.amaUserId.slice(0, 8));
      }
    }

    return {
      rows: rows.map((r) =>
        rowFromDb(r, {
          prime: primeMeta.get(r.pcsId),
          selling: sellingMeta.get(r.pcsId),
          listing: listingMeta.get(r.pcsId),
          latestEvent: latestEvent.get(r.pcsId),
          userNames,
        }),
      ),
      total: totalRes[0]?.count ?? 0,
    };
  });
}

export async function createPrimeCostAction(
  input: z.infer<typeof rowSchema> & { sourceNote?: string | null },
) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);
    const parsed = rowSchema.parse(input);
    const pcsId = randomUUID();
    await db.insert(schema.salPrimeCosts).values({
      pcsId,
      entId: user.entId,
      pcsProductId: parsed.productId ?? null,
      pcsVariationId: parsed.variationId ?? null,
      pcsVariationName: parsed.variationName ?? null,
      pcsProductNameVi: parsed.productNameVi,
      pcsProductNameEn: parsed.productNameEn ?? null,
      pcsSkuCode: parsed.skuCode,
      pcsGtin: parsed.gtin ?? null,
      pcsHsCode: parsed.hsCode ?? null,
      pcsPrimeCostVnd: parsed.primeCostVnd.toString(),
      pcsSellingPriceVnd: parsed.sellingPriceVnd != null ? parsed.sellingPriceVnd.toString() : null,
      pcsListingPriceVnd: parsed.listingPriceVnd != null ? parsed.listingPriceVnd.toString() : null,
      pcsIsCombo: parsed.isCombo ?? false,
      pcsComboMeta: parsed.comboMeta ?? null,
      pcsCreatedBy: user.userId,
    });
    // Auto-create initial version rows so the new SKU shows up on the
    // prime/selling/listing version pages immediately (they list versions,
    // not masters). Date = today. Note = caller-supplied or default.
    const today = todayIso();
    const note = (input.sourceNote ?? 'Initial — Product List').slice(0, 255);
    try {
      await addVersion({
        entId: user.entId,
        userId: user.userId,
        pcsId,
        effectiveFrom: today,
        primeCostVnd: parsed.primeCostVnd,
        sourceNote: note,
      });
    } catch (err) {
      if (!(err instanceof SalError && err.code === 'SAL-E0409')) throw err;
    }
    if (parsed.sellingPriceVnd != null) {
      try {
        await addSellingVersion({
          entId: user.entId,
          userId: user.userId,
          pcsId,
          effectiveFrom: today,
          sellingPriceVnd: parsed.sellingPriceVnd,
          sourceNote: note,
        });
      } catch (err) {
        if (!(err instanceof SalError && err.code === 'SAL-E0409')) throw err;
      }
    }
    if (parsed.listingPriceVnd != null) {
      try {
        await addListingVersion({
          entId: user.entId,
          userId: user.userId,
          pcsId,
          effectiveFrom: today,
          listingPriceVnd: parsed.listingPriceVnd,
          sourceNote: note,
        });
      } catch (err) {
        if (!(err instanceof SalError && err.code === 'SAL-E0409')) throw err;
      }
    }
    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'created',
      targetType: 'prime_cost',
      targetId: pcsId,
      targetLabel: `Prime Cost: ${parsed.skuCode} — ${parsed.productNameVi}`,
      summary: `Prime Cost ${parsed.primeCostVnd.toLocaleString('vi-VN')} VND`,
      metadata: { primeCostVnd: parsed.primeCostVnd, skuCode: parsed.skuCode },
      after: parsed,
    });
    revalidateCostMaster();
    return { pcsId };
  });
}

export async function updatePrimeCostAction(input: z.infer<typeof rowSchema> & { pcsId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);
    const { pcsId, ...rest } = input;
    const parsed = rowSchema.parse(rest);

    const beforeRows = await db
      .select()
      .from(schema.salPrimeCosts)
      .where(
        and(
          withEnt(schema.salPrimeCosts.entId, user.entId),
          eq(schema.salPrimeCosts.pcsId, pcsId),
          SOFT_DELETED,
        ),
      )
      .limit(1);
    const before = beforeRows[0];

    const result = await db
      .update(schema.salPrimeCosts)
      .set({
        pcsProductId: parsed.productId ?? null,
        pcsVariationId: parsed.variationId ?? null,
        pcsVariationName: parsed.variationName ?? null,
        pcsProductNameVi: parsed.productNameVi,
        pcsProductNameEn: parsed.productNameEn ?? null,
        pcsSkuCode: parsed.skuCode,
        pcsGtin: parsed.gtin ?? null,
        pcsHsCode: parsed.hsCode ?? null,
        pcsPrimeCostVnd: parsed.primeCostVnd.toString(),
        pcsSellingPriceVnd: parsed.sellingPriceVnd != null ? parsed.sellingPriceVnd.toString() : null,
        pcsListingPriceVnd: parsed.listingPriceVnd != null ? parsed.listingPriceVnd.toString() : null,
        pcsIsCombo: parsed.isCombo ?? before?.pcsIsCombo ?? false,
        pcsComboMeta:
          parsed.comboMeta !== undefined
            ? parsed.comboMeta
            : (before?.pcsComboMeta ?? null),
        pcsUpdatedAt: new Date(),
      })
      .where(
        and(
          withEnt(schema.salPrimeCosts.entId, user.entId),
          eq(schema.salPrimeCosts.pcsId, pcsId),
          SOFT_DELETED,
        ),
      )
      .returning({ pcsId: schema.salPrimeCosts.pcsId });
    if (!result[0]) throw new SalError('SAL-E0404', 404, 'Prime cost row not found');

    // Auto-create version rows when the corresponding price changed via Edit.
    // Mirrors CSV-import behaviour — every price change is captured as a new
    // version (effective_from = today) so the timeline stays complete.
    const today = todayIso();
    if (before) {
      const oldPrime = Number(before.pcsPrimeCostVnd);
      if (oldPrime !== parsed.primeCostVnd) {
        try {
          await addVersion({
            entId: user.entId,
            userId: user.userId,
            pcsId,
            effectiveFrom: today,
            primeCostVnd: parsed.primeCostVnd,
            sourceNote: 'Auto-version on Edit',
          });
        } catch (err) {
          // Same SKU + same date already has a version → swallow uniqueness conflict.
          if (!(err instanceof SalError && err.code === 'SAL-E0409')) throw err;
        }
      }
      const oldSelling =
        before.pcsSellingPriceVnd != null ? Number(before.pcsSellingPriceVnd) : null;
      if (parsed.sellingPriceVnd != null && parsed.sellingPriceVnd !== oldSelling) {
        try {
          await addSellingVersion({
            entId: user.entId,
            userId: user.userId,
            pcsId,
            effectiveFrom: today,
            sellingPriceVnd: parsed.sellingPriceVnd,
            sourceNote: 'Auto-version on Edit',
          });
        } catch (err) {
          if (!(err instanceof SalError && err.code === 'SAL-E0409')) throw err;
        }
      }
      const oldListing =
        before.pcsListingPriceVnd != null ? Number(before.pcsListingPriceVnd) : null;
      if (parsed.listingPriceVnd != null && parsed.listingPriceVnd !== oldListing) {
        try {
          await addListingVersion({
            entId: user.entId,
            userId: user.userId,
            pcsId,
            effectiveFrom: today,
            listingPriceVnd: parsed.listingPriceVnd,
            sourceNote: 'Auto-version on Edit',
          });
        } catch (err) {
          if (!(err instanceof SalError && err.code === 'SAL-E0409')) throw err;
        }
      }
    }

    if (before) {
      const oldCost = Number(before.pcsPrimeCostVnd);
      const costChanged = oldCost !== parsed.primeCostVnd;
      await logAction({
        user,
        category: 'MASTER_DATA',
        verb: 'updated',
        targetType: 'prime_cost',
        targetId: pcsId,
        targetLabel: `Prime Cost: ${parsed.skuCode} — ${parsed.productNameVi}`,
        summary: costChanged
          ? `Prime Cost: ${oldCost.toLocaleString('vi-VN')} → ${parsed.primeCostVnd.toLocaleString('vi-VN')}`
          : 'Metadata updated',
        metadata: { primeCostVnd: parsed.primeCostVnd, skuCode: parsed.skuCode },
        before: {
          primeCostVnd: oldCost,
          sellingPriceVnd: before.pcsSellingPriceVnd != null ? Number(before.pcsSellingPriceVnd) : null,
          listingPriceVnd: before.pcsListingPriceVnd != null ? Number(before.pcsListingPriceVnd) : null,
          productNameVi: before.pcsProductNameVi,
        },
        after: parsed,
      });
    }
    revalidateCostMaster();
    return { pcsId };
  });
}

export async function deletePrimeCostAction(input: { pcsId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);

    const beforeRows = await db
      .select()
      .from(schema.salPrimeCosts)
      .where(
        and(
          withEnt(schema.salPrimeCosts.entId, user.entId),
          eq(schema.salPrimeCosts.pcsId, input.pcsId),
          SOFT_DELETED,
        ),
      )
      .limit(1);
    const before = beforeRows[0];

    const result = await db
      .update(schema.salPrimeCosts)
      .set({ pcsDeletedAt: new Date(), pcsUpdatedAt: new Date() })
      .where(
        and(
          withEnt(schema.salPrimeCosts.entId, user.entId),
          eq(schema.salPrimeCosts.pcsId, input.pcsId),
          SOFT_DELETED,
        ),
      )
      .returning({ pcsId: schema.salPrimeCosts.pcsId });
    if (!result[0]) throw new SalError('SAL-E0404', 404, 'Prime cost row not found');

    if (before) {
      await logAction({
        user,
        category: 'MASTER_DATA',
        verb: 'deleted',
        targetType: 'prime_cost',
        targetId: input.pcsId,
        targetLabel: `Prime Cost: ${before.pcsSkuCode} — ${before.pcsProductNameVi}`,
        summary: 'Soft-deleted',
        metadata: { skuCode: before.pcsSkuCode },
        before: {
          primeCostVnd: Number(before.pcsPrimeCostVnd),
          productNameVi: before.pcsProductNameVi,
        },
      });
    }
    revalidateCostMaster();
    return { pcsId: input.pcsId };
  });
}

// Ignore the unused desc import (kept for future ORDER BY toggles)
void desc;

// ============================================================================
// CSV import/export (FR-05 — CSV/Excel bulk upload, CSV/Excel download)
// ============================================================================

const CSV_HEADER = [
  'Product ID',
  'Variation ID',
  'Variation Name',
  'Product (VI)',
  'Product (EN)',
  'SKU',
  'Prime Cost (VND)',
  'Selling Price (VND)',
  'Listing Price (VND)',
  // Per-field effective dates. Each is optional. On import, when a value
  // changes vs DB and the date column is empty → date = today. When value is
  // unchanged → the date column is ignored (no version created).
  'Effective From — Prime',
  'Effective From — Selling',
  'Effective From — Listing',
  // Combo / bundle flag — accepted values on import: 1/0, true/false, yes/no.
  // Empty preserves the existing DB value on UPDATE, defaults to false on INSERT.
  'Is Combo',
  // Combo metadata (Phase 1 reference). Underscore-separated list of component
  // SKU codes — e.g. "SKU_B_SKU_C". Empty preserves existing on UPDATE.
  'Combo Component SKUs',
] as const;

// Wrap value with ="..." so Excel treats it as text (preserves leading zeros,
// long numeric IDs without scientific notation, etc.)
function excelTextCell(value: string | null | undefined): string {
  if (!value) return '';
  return '="' + value.replace(/"/g, '""') + '"';
}

export type ExportField = 'prime' | 'selling' | 'listing' | 'all' | 'product';

export async function exportPrimeCostsAction(input: { field?: ExportField } = {}) {
  return wrap(async () => {
    const user = await getCurrentUser();
    const field: ExportField = input.field ?? 'all';
    const rows = await db
      .select()
      .from(schema.salPrimeCosts)
      .where(and(withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED))
      .orderBy(asc(schema.salPrimeCosts.pcsProductNameVi));

    // Latest-effective version per SKU per price field. Falls back to empty
    // string when no version exists (shouldn't happen post-backfill).
    const buildLatestMap = async <T extends { pcsId: string; effectiveFrom: string }>(
      rows: T[],
    ): Promise<Map<string, string>> => {
      const map = new Map<string, string>();
      for (const v of rows) {
        if (!map.has(v.pcsId)) map.set(v.pcsId, v.effectiveFrom);
      }
      return map;
    };

    const [primeVRows, sellingVRows, listingVRows] = await Promise.all([
      db
        .select({
          pcsId: schema.salPrimeCostVersions.pcsId,
          effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom,
        })
        .from(schema.salPrimeCostVersions)
        .where(
          and(
            withEnt(schema.salPrimeCostVersions.entId, user.entId),
            isNull(schema.salPrimeCostVersions.pcvDeletedAt),
          ),
        )
        .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom)),
      db
        .select({
          pcsId: schema.salSellingPriceVersions.pcsId,
          effectiveFrom: schema.salSellingPriceVersions.spvEffectiveFrom,
        })
        .from(schema.salSellingPriceVersions)
        .where(
          and(
            withEnt(schema.salSellingPriceVersions.entId, user.entId),
            isNull(schema.salSellingPriceVersions.spvDeletedAt),
          ),
        )
        .orderBy(desc(schema.salSellingPriceVersions.spvEffectiveFrom)),
      db
        .select({
          pcsId: schema.salListingPriceVersions.pcsId,
          effectiveFrom: schema.salListingPriceVersions.lpvEffectiveFrom,
        })
        .from(schema.salListingPriceVersions)
        .where(
          and(
            withEnt(schema.salListingPriceVersions.entId, user.entId),
            isNull(schema.salListingPriceVersions.lpvDeletedAt),
          ),
        )
        .orderBy(desc(schema.salListingPriceVersions.lpvEffectiveFrom)),
    ]);
    const primeLatest = await buildLatestMap(primeVRows);
    const sellingLatest = await buildLatestMap(sellingVRows);
    const listingLatest = await buildLatestMap(listingVRows);

    // Product List view: SKU-centric flat dump with GTIN + HS Code + latest
    // event timestamp/note. Doesn't include per-field effective dates because
    // the view aggregates across 3 price fields.
    if (field === 'product') {
      // Compute latest event (createdAt + sourceNote + createdBy) per pcsId
      // across all 3 version tables — same logic as listPrimeCostsAction.
      const [primeFull, sellingFull, listingFull] = await Promise.all([
        db
          .select({
            pcsId: schema.salPrimeCostVersions.pcsId,
            createdAt: schema.salPrimeCostVersions.pcvCreatedAt,
            sourceNote: schema.salPrimeCostVersions.pcvSourceNote,
            createdBy: schema.salPrimeCostVersions.pcvCreatedBy,
          })
          .from(schema.salPrimeCostVersions)
          .where(
            and(
              withEnt(schema.salPrimeCostVersions.entId, user.entId),
              isNull(schema.salPrimeCostVersions.pcvDeletedAt),
            ),
          ),
        db
          .select({
            pcsId: schema.salSellingPriceVersions.pcsId,
            createdAt: schema.salSellingPriceVersions.spvCreatedAt,
            sourceNote: schema.salSellingPriceVersions.spvSourceNote,
            createdBy: schema.salSellingPriceVersions.spvCreatedBy,
          })
          .from(schema.salSellingPriceVersions)
          .where(
            and(
              withEnt(schema.salSellingPriceVersions.entId, user.entId),
              isNull(schema.salSellingPriceVersions.spvDeletedAt),
            ),
          ),
        db
          .select({
            pcsId: schema.salListingPriceVersions.pcsId,
            createdAt: schema.salListingPriceVersions.lpvCreatedAt,
            sourceNote: schema.salListingPriceVersions.lpvSourceNote,
            createdBy: schema.salListingPriceVersions.lpvCreatedBy,
          })
          .from(schema.salListingPriceVersions)
          .where(
            and(
              withEnt(schema.salListingPriceVersions.entId, user.entId),
              isNull(schema.salListingPriceVersions.lpvDeletedAt),
            ),
          ),
      ]);
      const latestEvent = new Map<
        string,
        { createdAt: Date; sourceNote: string | null; createdBy: string | null }
      >();
      const consider = (
        pcsId: string,
        createdAt: Date,
        sourceNote: string | null,
        createdBy: string | null,
      ) => {
        const cur = latestEvent.get(pcsId);
        if (!cur || createdAt > cur.createdAt) {
          latestEvent.set(pcsId, { createdAt, sourceNote, createdBy });
        }
      };
      for (const v of primeFull) consider(v.pcsId, v.createdAt, v.sourceNote, v.createdBy);
      for (const v of sellingFull) consider(v.pcsId, v.createdAt, v.sourceNote, v.createdBy);
      for (const v of listingFull) consider(v.pcsId, v.createdAt, v.sourceNote, v.createdBy);

      // createdBy = AMA user ID — look up via usrAmaUserId, not usrId.
      const userIds = Array.from(
        new Set(
          [...latestEvent.values()]
            .map((e) => e.createdBy)
            .filter((id): id is string => id != null),
        ),
      );
      const userNames = new Map<string, string>();
      if (userIds.length > 0) {
        const userRows = await db
          .select({
            amaUserId: schema.salUsers.usrAmaUserId,
            usrName: schema.salUsers.usrName,
            usrEmail: schema.salUsers.usrEmail,
          })
          .from(schema.salUsers)
          .where(inArray(schema.salUsers.usrAmaUserId, userIds));
        for (const u of userRows) {
          const emailLocal = u.usrEmail?.split('@')[0] ?? null;
          userNames.set(u.amaUserId, u.usrName ?? emailLocal ?? u.amaUserId.slice(0, 8));
        }
      }

      const header: string[] = [
        'SKU',
        'GTIN',
        'HS Code',
        'Product (VI)',
        'Product (EN)',
        'Variation Name',
        'Prime Cost (VND)',
        'Selling Price (VND)',
        'Listing Price (VND)',
        'Last Updated',
        'Updated By',
        'Source / Note',
        'Is Combo',
        'Combo Component SKUs',
      ];
      const csvRows = rows.map((r) => {
        const meta = (r.pcsComboMeta as ComboMeta | null) ?? null;
        const components = (meta?.componentSkus ?? []).join('_');
        const ev = latestEvent.get(r.pcsId);
        const byName = ev?.createdBy
          ? (userNames.get(ev.createdBy) ?? ev.createdBy.slice(0, 8))
          : '';
        return [
          excelTextCell(r.pcsSkuCode),
          excelTextCell(r.pcsGtin),
          excelTextCell(r.pcsHsCode),
          r.pcsProductNameVi,
          r.pcsProductNameEn ?? '',
          r.pcsVariationName ?? '',
          Number(r.pcsPrimeCostVnd),
          r.pcsSellingPriceVnd != null ? Number(r.pcsSellingPriceVnd) : '',
          r.pcsListingPriceVnd != null ? Number(r.pcsListingPriceVnd) : '',
          ev ? ev.createdAt.toISOString() : '',
          byName,
          ev?.sourceNote ?? '',
          r.pcsIsCombo ? 'yes' : 'no',
          components,
        ];
      });
      const csv = buildCsv(header, csvRows);
      const today = new Date().toISOString().slice(0, 10);
      return { csv, filename: `product-list_${today}.csv`, count: rows.length };
    }

    // Build header + row shape dynamically — pages dedicated to one price
    // field don't need to see the other two prices or their effective dates.
    const includePrime = field === 'all' || field === 'prime';
    const includeSelling = field === 'all' || field === 'selling';
    const includeListing = field === 'all' || field === 'listing';

    const header: string[] = [
      'Product ID',
      'Variation ID',
      'Variation Name',
      'Product (VI)',
      'Product (EN)',
      'SKU',
    ];
    // GTIN + HS Code are SKU-level metadata — surface them in the full master
    // export ('all') so a single round-trip CSV preserves them. Per-field
    // exports stay focused on price columns.
    if (field === 'all') header.push('GTIN', 'HS Code');
    if (includePrime) header.push('Prime Cost (VND)');
    if (includeSelling) header.push('Selling Price (VND)');
    if (includeListing) header.push('Listing Price (VND)');
    if (includePrime) header.push('Effective From — Prime');
    if (includeSelling) header.push('Effective From — Selling');
    if (includeListing) header.push('Effective From — Listing');
    header.push('Is Combo', 'Combo Component SKUs');

    const csvRows = rows.map((r) => {
      const meta = (r.pcsComboMeta as ComboMeta | null) ?? null;
      const components = (meta?.componentSkus ?? []).join('_');
      const out: Array<string | number> = [
        excelTextCell(r.pcsProductId),
        excelTextCell(r.pcsVariationId),
        r.pcsVariationName ?? '',
        r.pcsProductNameVi,
        r.pcsProductNameEn ?? '',
        excelTextCell(r.pcsSkuCode),
      ];
      if (field === 'all') {
        out.push(excelTextCell(r.pcsGtin));
        out.push(excelTextCell(r.pcsHsCode));
      }
      if (includePrime) out.push(Number(r.pcsPrimeCostVnd));
      if (includeSelling)
        out.push(r.pcsSellingPriceVnd != null ? Number(r.pcsSellingPriceVnd) : '');
      if (includeListing)
        out.push(r.pcsListingPriceVnd != null ? Number(r.pcsListingPriceVnd) : '');
      if (includePrime) out.push(primeLatest.get(r.pcsId) ?? '');
      if (includeSelling) out.push(sellingLatest.get(r.pcsId) ?? '');
      if (includeListing) out.push(listingLatest.get(r.pcsId) ?? '');
      out.push(r.pcsIsCombo ? 'yes' : 'no');
      out.push(components);
      return out;
    });

    const csv = buildCsv(header, csvRows);
    const today = new Date().toISOString().slice(0, 10);
    const filename =
      field === 'all'
        ? `master_${today}.csv`
        : `${field}-price_${today}.csv`;
    return { csv, filename, count: rows.length };
  });
}

export interface ImportResult {
  inserted: number;
  updated: number;
  /** Prime-cost version rows inserted by this import. */
  versionsAdded: number;
  /** Selling-price version rows inserted by this import (Phase 1.2). */
  sellingVersionsAdded: number;
  /** Listing-price version rows inserted by this import (Phase 1.2). */
  listingVersionsAdded: number;
  errors: Array<{ rowIndex: number; sku?: string; message: string }>;
}

/** Today as ISO YYYY-MM-DD in local time. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function importPrimeCostsAction(input: { csv: string }) {
  return wrap<ImportResult>(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);

    const parsed = parseCsv(input.csv).filter((r) => r.some((c) => c.trim() !== ''));
    if (parsed.length === 0) {
      throw new SalError('SAL-E0410', 400, 'CSV is empty');
    }

    // Header-aware import: detect header + build per-column index map so
    // field-specific exports (e.g. selling-price-only CSV) can be re-uploaded
    // without breaking positional destructuring. Logic lives in
    // `@/lib/csv-import` so it's unit-tested independently of the action.
    const looksLikeHeader = detectHeader(parsed[0]!);
    const dataRows = looksLikeHeader ? parsed.slice(1) : parsed;
    const idx = buildColumnIndex(parsed[0]!, looksLikeHeader);

    // Load existing SKU → master row map for upsert. Phase 1 of versioning:
    // import treats "SKU + Prime Cost" as the only required fields. All other
    // columns, when blank in the CSV, preserve the DB value (so users can
    // re-upload a partially-edited file without losing metadata). Same fallback
    // also handles Excel-corrupted scientific-notation values on productId /
    // variationId.
    const existing = await db
      .select({
        pcsId: schema.salPrimeCosts.pcsId,
        sku: schema.salPrimeCosts.pcsSkuCode,
        productId: schema.salPrimeCosts.pcsProductId,
        variationId: schema.salPrimeCosts.pcsVariationId,
        variationName: schema.salPrimeCosts.pcsVariationName,
        productNameVi: schema.salPrimeCosts.pcsProductNameVi,
        productNameEn: schema.salPrimeCosts.pcsProductNameEn,
        gtin: schema.salPrimeCosts.pcsGtin,
        hsCode: schema.salPrimeCosts.pcsHsCode,
        primeCostVnd: schema.salPrimeCosts.pcsPrimeCostVnd,
        sellingPriceVnd: schema.salPrimeCosts.pcsSellingPriceVnd,
        listingPriceVnd: schema.salPrimeCosts.pcsListingPriceVnd,
        isCombo: schema.salPrimeCosts.pcsIsCombo,
        comboMeta: schema.salPrimeCosts.pcsComboMeta,
      })
      .from(schema.salPrimeCosts)
      .where(and(withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED));
    const existingBySku = new Map(existing.map((e) => [e.sku, e]));
    const skuToId = new Map(existing.map((e) => [e.sku, e.pcsId]));

    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      versionsAdded: 0,
      sellingVersionsAdded: 0,
      listingVersionsAdded: 0,
      errors: [],
    };
    const today = todayIso();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      const rowIndex = looksLikeHeader ? i + 2 : i + 1; // 1-based, plus 1 if header
      const productIdRaw = cell(row, idx.productId);
      const variationIdRaw = cell(row, idx.variationId);
      const variationNameRaw = cell(row, idx.variationName);
      const nameViRaw = cell(row, idx.productNameVi);
      const nameEnRaw = cell(row, idx.productNameEn);
      const skuRaw = cell(row, idx.sku);
      const primeCostRaw = cell(row, idx.primeCost);
      const sellingPriceRaw = cell(row, idx.sellingPrice);
      const listingPriceRaw = cell(row, idx.listingPrice);
      const effectiveFromRaw = cell(row, idx.effPrime);
      const sellingEffectiveRaw = cell(row, idx.effSelling);
      const listingEffectiveRaw = cell(row, idx.effListing);
      const isComboRaw = cell(row, idx.isCombo);
      const comboComponentsRaw = cell(row, idx.comboComponents);
      const gtinRaw = cell(row, idx.gtin);
      const hsCodeRaw = cell(row, idx.hsCode);

      let productId = productIdRaw ? stripExcelTextWrapper(productIdRaw) : '';
      let variationId = variationIdRaw ? stripExcelTextWrapper(variationIdRaw) : '';
      const sku = stripExcelTextWrapper(skuRaw ?? '');
      const nameVi = (nameViRaw ?? '').trim();

      if (!sku) {
        result.errors.push({ rowIndex, message: 'SKU is required' });
        continue;
      }
      // Product (VI) only required when inserting a new SKU. For UPDATE path,
      // missing/blank Product (VI) → keep existing DB value (common when user
      // partially edits a row and forgets to fill nameVi).
      if (!nameVi && !existingBySku.get(sku)) {
        result.errors.push({
          rowIndex,
          sku,
          message: 'Product (VI) is required when adding a new SKU',
        });
        continue;
      }
      // Excel-corrupted IDs (long numeric → scientific notation lost precision).
      // For existing SKUs (UPDATE path), preserve the DB value silently so a
      // Prime-Cost-only edit doesn't get blocked by an unrelated column Excel
      // mangled. For new SKUs (INSERT path), reject — we'd persist corrupted
      // data with no recovery.
      const existingRow = existingBySku.get(sku);
      if (productId && looksLikeScientificNotation(productId)) {
        if (existingRow) {
          productId = existingRow.productId ?? '';
        } else {
          result.errors.push({
            rowIndex,
            sku,
            message: `Product ID "${productId}" looks like scientific notation — Excel lost precision. Re-format the source column as Text and re-export.`,
          });
          continue;
        }
      }
      if (variationId && looksLikeScientificNotation(variationId)) {
        if (existingRow) {
          variationId = existingRow.variationId ?? '';
        } else {
          result.errors.push({
            rowIndex,
            sku,
            message: `Variation ID "${variationId}" looks like scientific notation — Excel lost precision. Re-format the source column as Text and re-export.`,
          });
          continue;
        }
      }

      // Prime Cost: required for INSERT, optional for UPDATE (preserves DB
      // value when the column is missing/blank — e.g. uploading a
      // selling-price-only CSV exported from the Selling Price page).
      const primeCostFromCsv = parseNumericLoose(primeCostRaw);
      if (primeCostFromCsv == null && !existingRow) {
        result.errors.push({
          rowIndex,
          sku,
          message: 'Prime Cost is required and must be numeric when adding a new SKU',
        });
        continue;
      }
      const primeCost =
        primeCostFromCsv != null
          ? primeCostFromCsv
          : Number(existingRow!.primeCostVnd ?? 0);

      // Build payload — blank cells preserve existing DB value when SKU is
      // an UPDATE. For new SKUs, blank → null (or fail-fast for nameVi above).
      const sellingFromCsv = parseNumericLoose(sellingPriceRaw);
      const listingFromCsv = parseNumericLoose(listingPriceRaw);
      const nameEnFromCsv = nameEnRaw?.trim() ?? '';
      // Parse Is Combo: empty preserves DB value on UPDATE / defaults false on INSERT.
      // Accepts: yes/no/y/n/true/false/1/0 (case-insensitive). Anything else → preserve.
      const isComboFromCsv = parseBool(isComboRaw);
      const isComboFinal =
        isComboFromCsv != null ? isComboFromCsv : (existingRow?.isCombo ?? false);

      // Combo metadata: empty cell preserves existing DB value on UPDATE.
      // Non-empty replaces. Empty cell on INSERT → null.
      const componentsTrim = (comboComponentsRaw ?? '').trim();
      const componentSkusFromCsv = componentsTrim
        ? componentsTrim
            .split('_')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : null;
      const existingMeta = (existingRow?.comboMeta as ComboMeta | null) ?? null;
      const nextComponents = componentSkusFromCsv ?? existingMeta?.componentSkus;
      const comboMetaFinal: ComboMeta | null =
        nextComponents && nextComponents.length > 0
          ? { componentSkus: nextComponents }
          : null;

      const variationNameFromCsv = (variationNameRaw ?? '').trim();
      const gtinFromCsv = (gtinRaw ? stripExcelTextWrapper(gtinRaw).trim() : '');
      const hsCodeFromCsv = (hsCodeRaw ? stripExcelTextWrapper(hsCodeRaw).trim() : '');
      const payload = {
        productId: productId || existingRow?.productId || null,
        variationId: variationId || existingRow?.variationId || null,
        variationName: variationNameFromCsv || existingRow?.variationName || null,
        productNameVi: nameVi || existingRow?.productNameVi || '',
        productNameEn: nameEnFromCsv || existingRow?.productNameEn || null,
        gtin: gtinFromCsv || existingRow?.gtin || null,
        hsCode: hsCodeFromCsv || existingRow?.hsCode || null,
        skuCode: sku,
        primeCostVnd: primeCost.toString(),
        sellingPriceVnd:
          sellingFromCsv != null
            ? sellingFromCsv.toString()
            : existingRow?.sellingPriceVnd != null
              ? String(existingRow.sellingPriceVnd)
              : null,
        listingPriceVnd:
          listingFromCsv != null
            ? listingFromCsv.toString()
            : existingRow?.listingPriceVnd != null
              ? String(existingRow.listingPriceVnd)
              : null,
        isCombo: isComboFinal,
        comboMeta: comboMetaFinal,
      };

      // Parse optional Effective From. Empty / missing → today.
      // Accept canonical YYYY-MM-DD plus Excel's auto-mangled M/D/YYYY (US)
      // and D/M/YYYY (VN). Round-tripping a CSV through Excel breaks the
      // canonical format — we try to recover here so users don't have to know.
      const parseDateCol = (raw: string | undefined, label: string): string | null | 'INVALID' => {
        if (!raw || !raw.trim()) return null;
        const trimmed = raw.trim();
        const parsedDate = parseFlexibleDate(trimmed);
        if (!parsedDate) {
          result.errors.push({
            rowIndex,
            sku,
            message: `${label} must be YYYY-MM-DD or M/D/YYYY (got "${trimmed}")`,
          });
          return 'INVALID';
        }
        return parsedDate;
      };

      const effPrimeParsed = parseDateCol(effectiveFromRaw, 'Effective From — Prime');
      if (effPrimeParsed === 'INVALID') continue;
      const effSellingParsed = parseDateCol(sellingEffectiveRaw, 'Effective From — Selling');
      if (effSellingParsed === 'INVALID') continue;
      const effListingParsed = parseDateCol(listingEffectiveRaw, 'Effective From — Listing');
      if (effListingParsed === 'INVALID') continue;

      const effectiveFrom = effPrimeParsed ?? today;

      try {
        let pcsId: string;
        const existingId = skuToId.get(sku);
        if (existingId) {
          pcsId = existingId;
          await db
            .update(schema.salPrimeCosts)
            .set({
              pcsProductId: payload.productId,
              pcsVariationId: payload.variationId,
              pcsVariationName: payload.variationName,
              pcsProductNameVi: payload.productNameVi,
              pcsProductNameEn: payload.productNameEn,
              pcsGtin: payload.gtin,
              pcsHsCode: payload.hsCode,
              pcsPrimeCostVnd: payload.primeCostVnd,
              pcsSellingPriceVnd: payload.sellingPriceVnd,
              pcsListingPriceVnd: payload.listingPriceVnd,
              pcsIsCombo: payload.isCombo,
              pcsComboMeta: payload.comboMeta,
              pcsUpdatedAt: new Date(),
            })
            .where(
              and(withEnt(schema.salPrimeCosts.entId, user.entId), eq(schema.salPrimeCosts.pcsId, existingId)),
            );
          result.updated += 1;
        } else {
          pcsId = randomUUID();
          await db.insert(schema.salPrimeCosts).values({
            pcsId,
            entId: user.entId,
            pcsProductId: payload.productId,
            pcsVariationId: payload.variationId,
            pcsVariationName: payload.variationName,
            pcsProductNameVi: payload.productNameVi,
            pcsProductNameEn: payload.productNameEn,
            pcsSkuCode: payload.skuCode,
            pcsGtin: payload.gtin,
            pcsHsCode: payload.hsCode,
            pcsPrimeCostVnd: payload.primeCostVnd,
            pcsSellingPriceVnd: payload.sellingPriceVnd,
            pcsListingPriceVnd: payload.listingPriceVnd,
            pcsIsCombo: payload.isCombo,
            pcsComboMeta: payload.comboMeta,
            pcsCreatedBy: user.userId,
          });
          skuToId.set(sku, pcsId);
          result.inserted += 1;
        }

        // Prime cost: insert a version ONLY when the CSV actually provided a
        // value AND it differs from the existing master cache. Matches
        // selling/listing logic — no point creating no-op rows that just
        // clutter the version timeline. Skips entirely on field-specific CSVs
        // that omit the Prime Cost column.
        const prevPrime = existingRow ? Number(existingRow.primeCostVnd ?? 0) : null;
        const primeValueChanged =
          primeCostFromCsv != null && (prevPrime == null || prevPrime !== primeCostFromCsv);
        if (primeValueChanged) {
          try {
            await db.insert(schema.salPrimeCostVersions).values({
              pcvId: randomUUID(),
              entId: user.entId,
              pcsId,
              pcvEffectiveFrom: effectiveFrom,
              pcvPrimeCostVnd: payload.primeCostVnd,
              pcvSourceNote: 'CSV import',
              pcvCreatedBy: user.userId,
            });
            result.versionsAdded += 1;
          } catch (vErr) {
            const vMsg = vErr instanceof Error ? vErr.message : String(vErr);
            if (!/uniq_sal_pcv_ent_sku_date|duplicate key/.test(vMsg)) {
              result.errors.push({
                rowIndex,
                sku,
                message: `Prime-cost version insert failed: ${vMsg}`,
              });
            }
          }
        }

        // Selling-price version: only insert if a new value was provided AND
        // it differs from the existing master cache. Date defaults to today
        // when only the value changed. Same unique-conflict tolerance as above.
        const prevSelling =
          existingRow?.sellingPriceVnd != null ? Number(existingRow.sellingPriceVnd) : null;
        const sellingValueChanged =
          sellingFromCsv != null && (prevSelling == null || prevSelling !== sellingFromCsv);
        if (sellingValueChanged) {
          const sellingEff = effSellingParsed ?? today;
          try {
            await db.insert(schema.salSellingPriceVersions).values({
              spvId: randomUUID(),
              entId: user.entId,
              pcsId,
              spvEffectiveFrom: sellingEff,
              spvSellingPriceVnd: sellingFromCsv.toString(),
              spvSourceNote: 'CSV import',
              spvCreatedBy: user.userId,
            });
            result.sellingVersionsAdded += 1;
          } catch (vErr) {
            const vMsg = vErr instanceof Error ? vErr.message : String(vErr);
            if (!/uniq_sal_spv_ent_sku_date|duplicate key/.test(vMsg)) {
              result.errors.push({
                rowIndex,
                sku,
                message: `Selling-price version insert failed: ${vMsg}`,
              });
            }
          }
        }

        const prevListing =
          existingRow?.listingPriceVnd != null ? Number(existingRow.listingPriceVnd) : null;
        const listingValueChanged =
          listingFromCsv != null && (prevListing == null || prevListing !== listingFromCsv);
        if (listingValueChanged) {
          const listingEff = effListingParsed ?? today;
          try {
            await db.insert(schema.salListingPriceVersions).values({
              lpvId: randomUUID(),
              entId: user.entId,
              pcsId,
              lpvEffectiveFrom: listingEff,
              lpvListingPriceVnd: listingFromCsv.toString(),
              lpvSourceNote: 'CSV import',
              lpvCreatedBy: user.userId,
            });
            result.listingVersionsAdded += 1;
          } catch (vErr) {
            const vMsg = vErr instanceof Error ? vErr.message : String(vErr);
            if (!/uniq_sal_lpv_ent_sku_date|duplicate key/.test(vMsg)) {
              result.errors.push({
                rowIndex,
                sku,
                message: `Listing-price version insert failed: ${vMsg}`,
              });
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ rowIndex, sku, message: msg });
      }
    }

    if (result.inserted + result.updated > 0) {
      await logAction({
        user,
        category: 'MASTER_DATA',
        verb: 'imported',
        targetType: 'prime_cost',
        targetLabel: `Prime Cost CSV import (${result.inserted + result.updated} rows)`,
        summary:
          `Inserted ${result.inserted} · Updated ${result.updated} · ` +
          `Prime versions: ${result.versionsAdded} · ` +
          `Selling versions: ${result.sellingVersionsAdded} · ` +
          `Listing versions: ${result.listingVersionsAdded}` +
          (result.errors.length > 0 ? ` · Skipped ${result.errors.length}` : ''),
        metadata: {
          inserted: result.inserted,
          updated: result.updated,
          versionsAdded: result.versionsAdded,
          sellingVersionsAdded: result.sellingVersionsAdded,
          listingVersionsAdded: result.listingVersionsAdded,
          errors: result.errors.length,
        },
      });
    }

    revalidateCostMaster();
    return result;
  });
}

// ---------------------------------------------------------------------------
// Prime cost versions (Phase 1 of inventory-cost evolution).
// See REQ-20260521-prime-cost-versioning.
// ---------------------------------------------------------------------------

const addVersionSchema = z.object({
  pcsId: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
  primeCostVnd: z.number().nonnegative(),
  breakdown: z.record(z.string(), z.unknown()).optional().nullable(),
  sourceNote: z.string().max(255).optional().nullable(),
});

export async function addPrimeCostVersionAction(
  input: z.infer<typeof addVersionSchema>,
) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);
    const parsed = addVersionSchema.parse(input);

    // Capture previous-latest cost for log Δ calculation
    const before = await listVersionsForSku(user.entId, parsed.pcsId);
    const prevLatestCost = before[0]?.primeCostVnd ?? null;

    const { pcvId } = await addVersion({
      entId: user.entId,
      userId: user.userId,
      pcsId: parsed.pcsId,
      effectiveFrom: parsed.effectiveFrom,
      primeCostVnd: parsed.primeCostVnd,
      breakdown: parsed.breakdown ?? null,
      sourceNote: parsed.sourceNote ?? null,
    });

    // Fetch SKU code for human-readable log
    const skuRow = await db
      .select({ sku: schema.salPrimeCosts.pcsSkuCode })
      .from(schema.salPrimeCosts)
      .where(eq(schema.salPrimeCosts.pcsId, parsed.pcsId))
      .limit(1);
    const sku = skuRow[0]?.sku ?? parsed.pcsId;

    const deltaPct =
      prevLatestCost != null && prevLatestCost > 0
        ? ((parsed.primeCostVnd - prevLatestCost) / prevLatestCost) * 100
        : null;
    const deltaStr =
      prevLatestCost != null && deltaPct != null
        ? ` (Δ ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`
        : ' (initial version)';

    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'add_version',
      targetType: 'prime_cost_version',
      targetLabel: sku,
      summary:
        `Added prime cost version for ${sku} effective ${parsed.effectiveFrom}: ` +
        `${prevLatestCost ?? 0} → ${parsed.primeCostVnd}${deltaStr}`,
      metadata: {
        pcsId: parsed.pcsId,
        pcvId,
        effectiveFrom: parsed.effectiveFrom,
        primeCostVnd: parsed.primeCostVnd,
        previousLatestVnd: prevLatestCost,
        breakdown: parsed.breakdown,
        sourceNote: parsed.sourceNote,
      },
    });

    revalidateCostMaster();
    return { pcvId };
  });
}

export async function listPrimeCostVersionsAction(input: { pcsId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    const versions = await listVersionsForSku(user.entId, input.pcsId);
    return { versions };
  });
}

export async function softDeletePrimeCostVersionAction(input: { pcvId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);

    const { pcsId } = await softDeleteVersion(user.entId, input.pcvId);

    const skuRow = await db
      .select({ sku: schema.salPrimeCosts.pcsSkuCode })
      .from(schema.salPrimeCosts)
      .where(eq(schema.salPrimeCosts.pcsId, pcsId))
      .limit(1);
    const sku = skuRow[0]?.sku ?? pcsId;

    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'delete_version',
      targetType: 'prime_cost_version',
      targetLabel: sku,
      summary: `Soft-deleted prime cost version for ${sku}`,
      metadata: { pcsId, pcvId: input.pcvId },
    });

    revalidateCostMaster();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Selling price + Listing price versions (Phase 1.2).
// See REQ-20260526-price-versioning.
// ---------------------------------------------------------------------------

const addPriceVersionSchema = z.object({
  pcsId: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
  valueVnd: z.number().nonnegative(),
  sourceNote: z.string().max(255).optional().nullable(),
});

async function lookupSkuLabel(pcsId: string): Promise<string> {
  const row = await db
    .select({ sku: schema.salPrimeCosts.pcsSkuCode })
    .from(schema.salPrimeCosts)
    .where(eq(schema.salPrimeCosts.pcsId, pcsId))
    .limit(1);
  return row[0]?.sku ?? pcsId;
}

export async function addSellingPriceVersionAction(
  input: z.infer<typeof addPriceVersionSchema>,
) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);
    const parsed = addPriceVersionSchema.parse(input);

    const before = await listSellingVersionsForSku(user.entId, parsed.pcsId);
    const prev = before[0]?.sellingPriceVnd ?? null;

    const { spvId } = await addSellingVersion({
      entId: user.entId,
      userId: user.userId,
      pcsId: parsed.pcsId,
      effectiveFrom: parsed.effectiveFrom,
      sellingPriceVnd: parsed.valueVnd,
      sourceNote: parsed.sourceNote ?? null,
    });

    const sku = await lookupSkuLabel(parsed.pcsId);
    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'add_selling_version',
      targetType: 'selling_price_version',
      targetLabel: sku,
      summary: `Added selling-price version for ${sku} effective ${parsed.effectiveFrom}: ${prev ?? 0} → ${parsed.valueVnd}`,
      metadata: { pcsId: parsed.pcsId, spvId, effectiveFrom: parsed.effectiveFrom, valueVnd: parsed.valueVnd, previousVnd: prev },
    });
    revalidateCostMaster();
    return { spvId };
  });
}

export async function listSellingPriceVersionsAction(input: { pcsId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    const versions = await listSellingVersionsForSku(user.entId, input.pcsId);
    return { versions };
  });
}

export async function softDeleteSellingPriceVersionAction(input: { spvId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);

    const { pcsId } = await softDeleteSellingVersion(user.entId, input.spvId);
    const sku = await lookupSkuLabel(pcsId);
    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'delete_selling_version',
      targetType: 'selling_price_version',
      targetLabel: sku,
      summary: `Soft-deleted selling-price version for ${sku}`,
      metadata: { pcsId, spvId: input.spvId },
    });
    revalidateCostMaster();
    return { ok: true };
  });
}

export async function addListingPriceVersionAction(
  input: z.infer<typeof addPriceVersionSchema>,
) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);
    const parsed = addPriceVersionSchema.parse(input);

    const before = await listListingVersionsForSku(user.entId, parsed.pcsId);
    const prev = before[0]?.listingPriceVnd ?? null;

    const { lpvId } = await addListingVersion({
      entId: user.entId,
      userId: user.userId,
      pcsId: parsed.pcsId,
      effectiveFrom: parsed.effectiveFrom,
      listingPriceVnd: parsed.valueVnd,
      sourceNote: parsed.sourceNote ?? null,
    });

    const sku = await lookupSkuLabel(parsed.pcsId);
    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'add_listing_version',
      targetType: 'listing_price_version',
      targetLabel: sku,
      summary: `Added listing-price version for ${sku} effective ${parsed.effectiveFrom}: ${prev ?? 0} → ${parsed.valueVnd}`,
      metadata: { pcsId: parsed.pcsId, lpvId, effectiveFrom: parsed.effectiveFrom, valueVnd: parsed.valueVnd, previousVnd: prev },
    });
    revalidateCostMaster();
    return { lpvId };
  });
}

export async function listListingPriceVersionsAction(input: { pcsId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    const versions = await listListingVersionsForSku(user.entId, input.pcsId);
    return { versions };
  });
}

/** Flat version-list payload — one row per version, joined with the SKU master for display. */
export interface FlatVersionRow {
  versionId: string;
  pcsId: string;
  skuCode: string;
  productNameVi: string;
  productNameEn: string | null;
  variationName: string | null;
  /** Combo flag from the SKU master — for Combo badge in the list. */
  isCombo: boolean;
  /** Component SKU codes (when this SKU is a combo with components stored in pcs_combo_meta). */
  componentSkus: string[] | null;
  effectiveFrom: string;
  valueVnd: number;
  sourceNote: string | null;
  /** Raw AMA user ID of the version author. */
  createdBy: string;
  /** Human-readable display name resolved from sal_users (or short prefix fallback). */
  createdByDisplay: string;
  createdAt: string;
}

/**
 * Resolve a batch of AMA user IDs to display names. Falls back to
 * email-local-part, then a short UUID prefix, so the UI never leaks a
 * full UUID. Same fallback chain as `listPrimeCostsAction`.
 */
async function resolveAmaUserDisplayNames(
  amaUserIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (amaUserIds.length === 0) return map;
  const userRows = await db
    .select({
      amaUserId: schema.salUsers.usrAmaUserId,
      usrName: schema.salUsers.usrName,
      usrEmail: schema.salUsers.usrEmail,
    })
    .from(schema.salUsers)
    .where(inArray(schema.salUsers.usrAmaUserId, amaUserIds));
  for (const u of userRows) {
    const emailLocal = u.usrEmail?.split('@')[0] ?? null;
    map.set(u.amaUserId, u.usrName ?? emailLocal ?? u.amaUserId.slice(0, 8));
  }
  return map;
}

function displayNameFor(amaUserId: string, names: Map<string, string>): string {
  return names.get(amaUserId) ?? amaUserId.slice(0, 8);
}

export async function listFlatVersionsAction(input: {
  field: 'prime' | 'selling' | 'listing';
  limit?: number;
}) {
  return wrap(async () => {
    const user = await getCurrentUser();
    const limit = input.limit ?? 1000;
    if (input.field === 'prime') {
      const rows = await db
        .select({
          versionId: schema.salPrimeCostVersions.pcvId,
          pcsId: schema.salPrimeCostVersions.pcsId,
          skuCode: schema.salPrimeCosts.pcsSkuCode,
          productNameVi: schema.salPrimeCosts.pcsProductNameVi,
          productNameEn: schema.salPrimeCosts.pcsProductNameEn,
          variationName: schema.salPrimeCosts.pcsVariationName,
          isCombo: schema.salPrimeCosts.pcsIsCombo,
          comboMeta: schema.salPrimeCosts.pcsComboMeta,
          effectiveFrom: schema.salPrimeCostVersions.pcvEffectiveFrom,
          valueVnd: schema.salPrimeCostVersions.pcvPrimeCostVnd,
          sourceNote: schema.salPrimeCostVersions.pcvSourceNote,
          createdBy: schema.salPrimeCostVersions.pcvCreatedBy,
          createdAt: schema.salPrimeCostVersions.pcvCreatedAt,
        })
        .from(schema.salPrimeCostVersions)
        .innerJoin(
          schema.salPrimeCosts,
          eq(schema.salPrimeCostVersions.pcsId, schema.salPrimeCosts.pcsId),
        )
        .where(
          and(
            withEnt(schema.salPrimeCostVersions.entId, user.entId),
            isNull(schema.salPrimeCostVersions.pcvDeletedAt),
            isNull(schema.salPrimeCosts.pcsDeletedAt),
          ),
        )
        .orderBy(
          asc(schema.salPrimeCosts.pcsProductNameVi),
          asc(schema.salPrimeCosts.pcsSkuCode),
          desc(schema.salPrimeCostVersions.pcvEffectiveFrom),
        )
        .limit(limit);
      const names = await resolveAmaUserDisplayNames(
        Array.from(new Set(rows.map((r) => r.createdBy))),
      );
      return {
        rows: rows.map<FlatVersionRow>((r) => ({
          versionId: r.versionId,
          pcsId: r.pcsId,
          skuCode: r.skuCode,
          productNameVi: r.productNameVi,
          productNameEn: r.productNameEn,
          variationName: r.variationName,
          isCombo: r.isCombo,
          componentSkus: ((r.comboMeta as ComboMeta | null)?.componentSkus ?? null) as
            | string[]
            | null,
          effectiveFrom: r.effectiveFrom,
          valueVnd: Number(r.valueVnd),
          sourceNote: r.sourceNote,
          createdBy: r.createdBy,
          createdByDisplay: displayNameFor(r.createdBy, names),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }
    if (input.field === 'selling') {
      const rows = await db
        .select({
          versionId: schema.salSellingPriceVersions.spvId,
          pcsId: schema.salSellingPriceVersions.pcsId,
          skuCode: schema.salPrimeCosts.pcsSkuCode,
          productNameVi: schema.salPrimeCosts.pcsProductNameVi,
          productNameEn: schema.salPrimeCosts.pcsProductNameEn,
          variationName: schema.salPrimeCosts.pcsVariationName,
          isCombo: schema.salPrimeCosts.pcsIsCombo,
          comboMeta: schema.salPrimeCosts.pcsComboMeta,
          effectiveFrom: schema.salSellingPriceVersions.spvEffectiveFrom,
          valueVnd: schema.salSellingPriceVersions.spvSellingPriceVnd,
          sourceNote: schema.salSellingPriceVersions.spvSourceNote,
          createdBy: schema.salSellingPriceVersions.spvCreatedBy,
          createdAt: schema.salSellingPriceVersions.spvCreatedAt,
        })
        .from(schema.salSellingPriceVersions)
        .innerJoin(
          schema.salPrimeCosts,
          eq(schema.salSellingPriceVersions.pcsId, schema.salPrimeCosts.pcsId),
        )
        .where(
          and(
            withEnt(schema.salSellingPriceVersions.entId, user.entId),
            isNull(schema.salSellingPriceVersions.spvDeletedAt),
            isNull(schema.salPrimeCosts.pcsDeletedAt),
          ),
        )
        .orderBy(
          asc(schema.salPrimeCosts.pcsProductNameVi),
          asc(schema.salPrimeCosts.pcsSkuCode),
          desc(schema.salSellingPriceVersions.spvEffectiveFrom),
        )
        .limit(limit);
      const names = await resolveAmaUserDisplayNames(
        Array.from(new Set(rows.map((r) => r.createdBy))),
      );
      return {
        rows: rows.map<FlatVersionRow>((r) => ({
          versionId: r.versionId,
          pcsId: r.pcsId,
          skuCode: r.skuCode,
          productNameVi: r.productNameVi,
          productNameEn: r.productNameEn,
          variationName: r.variationName,
          isCombo: r.isCombo,
          componentSkus: ((r.comboMeta as ComboMeta | null)?.componentSkus ?? null) as
            | string[]
            | null,
          effectiveFrom: r.effectiveFrom,
          valueVnd: Number(r.valueVnd),
          sourceNote: r.sourceNote,
          createdBy: r.createdBy,
          createdByDisplay: displayNameFor(r.createdBy, names),
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }
    // listing
    const rows = await db
      .select({
        versionId: schema.salListingPriceVersions.lpvId,
        pcsId: schema.salListingPriceVersions.pcsId,
        skuCode: schema.salPrimeCosts.pcsSkuCode,
        productNameVi: schema.salPrimeCosts.pcsProductNameVi,
        productNameEn: schema.salPrimeCosts.pcsProductNameEn,
        variationName: schema.salPrimeCosts.pcsVariationName,
        isCombo: schema.salPrimeCosts.pcsIsCombo,
        comboMeta: schema.salPrimeCosts.pcsComboMeta,
        effectiveFrom: schema.salListingPriceVersions.lpvEffectiveFrom,
        valueVnd: schema.salListingPriceVersions.lpvListingPriceVnd,
        sourceNote: schema.salListingPriceVersions.lpvSourceNote,
        createdBy: schema.salListingPriceVersions.lpvCreatedBy,
        createdAt: schema.salListingPriceVersions.lpvCreatedAt,
      })
      .from(schema.salListingPriceVersions)
      .innerJoin(
        schema.salPrimeCosts,
        eq(schema.salListingPriceVersions.pcsId, schema.salPrimeCosts.pcsId),
      )
      .where(
        and(
          withEnt(schema.salListingPriceVersions.entId, user.entId),
          isNull(schema.salListingPriceVersions.lpvDeletedAt),
          isNull(schema.salPrimeCosts.pcsDeletedAt),
        ),
      )
      .orderBy(
        asc(schema.salPrimeCosts.pcsProductNameVi),
        asc(schema.salPrimeCosts.pcsSkuCode),
        desc(schema.salListingPriceVersions.lpvEffectiveFrom),
      )
      .limit(limit);
    const names = await resolveAmaUserDisplayNames(
      Array.from(new Set(rows.map((r) => r.createdBy))),
    );
    return {
      rows: rows.map<FlatVersionRow>((r) => ({
        versionId: r.versionId,
        pcsId: r.pcsId,
        skuCode: r.skuCode,
        productNameVi: r.productNameVi,
        productNameEn: r.productNameEn,
        variationName: r.variationName,
        isCombo: r.isCombo,
        componentSkus: ((r.comboMeta as ComboMeta | null)?.componentSkus ?? null) as
          | string[]
          | null,
        effectiveFrom: r.effectiveFrom,
        valueVnd: Number(r.valueVnd),
        sourceNote: r.sourceNote,
        createdBy: r.createdBy,
        createdByDisplay: displayNameFor(r.createdBy, names),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
}

export async function softDeleteListingPriceVersionAction(input: { lpvId: string }) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);

    const { pcsId } = await softDeleteListingVersion(user.entId, input.lpvId);
    const sku = await lookupSkuLabel(pcsId);
    await logAction({
      user,
      category: 'MASTER_DATA',
      verb: 'delete_listing_version',
      targetType: 'listing_price_version',
      targetLabel: sku,
      summary: `Soft-deleted listing-price version for ${sku}`,
      metadata: { pcsId, lpvId: input.lpvId },
    });
    revalidateCostMaster();
    return { ok: true };
  });
}
