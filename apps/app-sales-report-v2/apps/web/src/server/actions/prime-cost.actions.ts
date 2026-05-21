'use server';

import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema, withEnt } from '@v2/db';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { buildCsv, parseCsv } from '@/lib/csv';
import { logAction } from '@/server/services/action-log.service';
import {
  addVersion,
  listVersionsForSku,
  softDeleteVersion,
} from '@/server/services/prime-cost-version.service';

const SOFT_DELETED = isNull(schema.salPrimeCosts.pcsDeletedAt);

const rowSchema = z.object({
  productId: z.string().max(64).optional().nullable(),
  variationId: z.string().max(64).optional().nullable(),
  productNameVi: z.string().min(1).max(512),
  productNameEn: z.string().max(512).optional().nullable(),
  skuCode: z.string().min(1).max(128),
  primeCostVnd: z.number().nonnegative(),
  sellingPriceVnd: z.number().nonnegative().optional().nullable(),
  listingPriceVnd: z.number().nonnegative().optional().nullable(),
});

export type PrimeCostRow = {
  pcsId: string;
  productId: string | null;
  variationId: string | null;
  productNameVi: string;
  productNameEn: string | null;
  skuCode: string;
  primeCostVnd: number;
  sellingPriceVnd: number | null;
  listingPriceVnd: number | null;
  updatedAt: string | null;
  /** Effective-from date of the latest active version (Phase 1 versioning). */
  effectiveFromLatest: string | null;
  /** Number of active (non-deleted) versions in history. */
  versionCount: number;
};

function rowFromDb(
  r: typeof schema.salPrimeCosts.$inferSelect,
  versionMeta?: { latest: string | null; count: number },
): PrimeCostRow {
  return {
    pcsId: r.pcsId,
    productId: r.pcsProductId,
    variationId: r.pcsVariationId,
    productNameVi: r.pcsProductNameVi,
    productNameEn: r.pcsProductNameEn,
    skuCode: r.pcsSkuCode,
    primeCostVnd: Number(r.pcsPrimeCostVnd),
    sellingPriceVnd: r.pcsSellingPriceVnd != null ? Number(r.pcsSellingPriceVnd) : null,
    listingPriceVnd: r.pcsListingPriceVnd != null ? Number(r.pcsListingPriceVnd) : null,
    updatedAt: (r.pcsUpdatedAt ?? r.pcsCreatedAt).toISOString(),
    effectiveFromLatest: versionMeta?.latest ?? null,
    versionCount: versionMeta?.count ?? 0,
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

    // Fetch version metadata (latest effective_from + active count) per SKU
    // so the table can show when the current cost started applying.
    const versionMetaByPcsId = new Map<string, { latest: string | null; count: number }>();
    {
      const vRows = await db
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
        .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom));
      for (const v of vRows) {
        const m = versionMetaByPcsId.get(v.pcsId);
        if (!m) {
          versionMetaByPcsId.set(v.pcsId, { latest: v.effectiveFrom, count: 1 });
        } else {
          m.count += 1;
        }
      }
    }

    return {
      rows: rows.map((r) => rowFromDb(r, versionMetaByPcsId.get(r.pcsId))),
      total: totalRes[0]?.count ?? 0,
    };
  });
}

export async function createPrimeCostAction(input: z.infer<typeof rowSchema>) {
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
      pcsProductNameVi: parsed.productNameVi,
      pcsProductNameEn: parsed.productNameEn ?? null,
      pcsSkuCode: parsed.skuCode,
      pcsPrimeCostVnd: parsed.primeCostVnd.toString(),
      pcsSellingPriceVnd: parsed.sellingPriceVnd != null ? parsed.sellingPriceVnd.toString() : null,
      pcsListingPriceVnd: parsed.listingPriceVnd != null ? parsed.listingPriceVnd.toString() : null,
      pcsCreatedBy: user.userId,
    });
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
        pcsProductNameVi: parsed.productNameVi,
        pcsProductNameEn: parsed.productNameEn ?? null,
        pcsSkuCode: parsed.skuCode,
        pcsPrimeCostVnd: parsed.primeCostVnd.toString(),
        pcsSellingPriceVnd: parsed.sellingPriceVnd != null ? parsed.sellingPriceVnd.toString() : null,
        pcsListingPriceVnd: parsed.listingPriceVnd != null ? parsed.listingPriceVnd.toString() : null,
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
  'Product (VI)',
  'Product (EN)',
  'SKU',
  'Prime Cost (VND)',
  'Selling Price (VND)',
  'Listing Price (VND)',
  // Optional: when omitted from upload, each row creates a version effective today.
  'Effective From',
] as const;

// Wrap value with ="..." so Excel treats it as text (preserves leading zeros,
// long numeric IDs without scientific notation, etc.)
function excelTextCell(value: string | null | undefined): string {
  if (!value) return '';
  return '="' + value.replace(/"/g, '""') + '"';
}

export async function exportPrimeCostsAction() {
  return wrap(async () => {
    const user = await getCurrentUser();
    const rows = await db
      .select()
      .from(schema.salPrimeCosts)
      .where(and(withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED))
      .orderBy(asc(schema.salPrimeCosts.pcsProductNameVi));

    // Latest-effective version per SKU — used to populate the Effective From
    // column in the export. Falls back to empty string when no version exists
    // (shouldn't happen post-backfill, but defensive).
    const latestByPcsId = new Map<string, string>();
    {
      const vRows = await db
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
        .orderBy(desc(schema.salPrimeCostVersions.pcvEffectiveFrom));
      for (const v of vRows) {
        if (!latestByPcsId.has(v.pcsId)) latestByPcsId.set(v.pcsId, v.effectiveFrom);
      }
    }

    const csvRows = rows.map((r) => [
      excelTextCell(r.pcsProductId),
      excelTextCell(r.pcsVariationId),
      r.pcsProductNameVi,
      r.pcsProductNameEn ?? '',
      excelTextCell(r.pcsSkuCode),
      Number(r.pcsPrimeCostVnd),
      r.pcsSellingPriceVnd != null ? Number(r.pcsSellingPriceVnd) : '',
      r.pcsListingPriceVnd != null ? Number(r.pcsListingPriceVnd) : '',
      latestByPcsId.get(r.pcsId) ?? '',
    ]);

    const csv = buildCsv([...CSV_HEADER], csvRows);
    const filename = `prime-cost_${new Date().toISOString().slice(0, 10)}.csv`;
    return { csv, filename, count: rows.length };
  });
}

function parseNumericLoose(s: string | undefined): number | null {
  if (s == null) return null;
  const trimmed = stripExcelTextWrapper(s.trim());
  if (!trimmed) return null;
  // Strip thousand separators (comma or dot) and any whitespace
  const cleaned = trimmed.replace(/[,.\s]/g, '');
  if (!/^\d+$/.test(cleaned)) {
    const n = Number(trimmed.replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Strip Excel "=..." text wrapper if present, e.g., ="243646783891" → 243646783891
function stripExcelTextWrapper(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length >= 3 && trimmed.startsWith('="') && trimmed.endsWith('"')) {
    return trimmed.slice(2, -1);
  }
  return trimmed;
}

// Detect Excel's scientific notation form (e.g., "2.27886E+11") — Excel lossy-converts long numeric IDs
function looksLikeScientificNotation(s: string): boolean {
  return /^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(s.trim());
}

export interface ImportResult {
  inserted: number;
  updated: number;
  versionsAdded: number;
  errors: Array<{ rowIndex: number; sku?: string; message: string }>;
}

/** Today as ISO YYYY-MM-DD in local time. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parse a date string into canonical `YYYY-MM-DD`. Accepts:
 *   - `YYYY-MM-DD` (canonical)
 *   - `M/D/YYYY` or `MM/DD/YYYY` (US — Excel default on many locales)
 *   - `D/M/YYYY` or `DD/MM/YYYY` (VN — auto-detected when month > 12)
 * Returns null on unparseable input.
 *
 * Ambiguous slash dates (both parts ≤ 12) are interpreted as US (MM/DD/YYYY)
 * since Excel on Windows defaults to that even in VN locale.
 */
function parseFlexibleDate(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Canonical ISO
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const pad = (n: string) => n.padStart(2, '0');
    return `${iso[1]}-${pad(iso[2]!)}-${pad(iso[3]!)}`;
  }
  // Slash format: A/B/YYYY — A and B disambiguated by value
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = slash[3]!;
    let month: number;
    let day: number;
    if (a > 12 && b <= 12) {
      // Must be D/M/YYYY (VN)
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      // Must be M/D/YYYY (US)
      month = a;
      day = b;
    } else {
      // Both ≤ 12 — default to US (Excel default on Windows)
      month = a;
      day = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${y}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

export async function importPrimeCostsAction(input: { csv: string }) {
  return wrap<ImportResult>(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['OPERATOR', 'ADMIN']);

    const parsed = parseCsv(input.csv).filter((r) => r.some((c) => c.trim() !== ''));
    if (parsed.length === 0) {
      throw new SalError('SAL-E0410', 400, 'CSV is empty');
    }

    // Detect header — accept either the canonical header or skip if it looks like data
    const firstRow = parsed[0]!.map((c) => c.trim().toLowerCase());
    const looksLikeHeader =
      firstRow.includes('sku') ||
      firstRow.some((c) => c.includes('product')) ||
      firstRow.some((c) => c.includes('prime cost'));
    const dataRows = looksLikeHeader ? parsed.slice(1) : parsed;

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
        productNameVi: schema.salPrimeCosts.pcsProductNameVi,
        productNameEn: schema.salPrimeCosts.pcsProductNameEn,
        sellingPriceVnd: schema.salPrimeCosts.pcsSellingPriceVnd,
        listingPriceVnd: schema.salPrimeCosts.pcsListingPriceVnd,
      })
      .from(schema.salPrimeCosts)
      .where(and(withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED));
    const existingBySku = new Map(existing.map((e) => [e.sku, e]));
    const skuToId = new Map(existing.map((e) => [e.sku, e.pcsId]));

    const result: ImportResult = { inserted: 0, updated: 0, versionsAdded: 0, errors: [] };
    const today = todayIso();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      const rowIndex = looksLikeHeader ? i + 2 : i + 1; // 1-based, plus 1 if header
      const [
        productIdRaw,
        variationIdRaw,
        nameViRaw,
        nameEnRaw,
        skuRaw,
        primeCostRaw,
        sellingPriceRaw,
        listingPriceRaw,
        effectiveFromRaw, // optional 9th column — Phase 1 of prime cost versioning
      ] = row;

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

      const primeCost = parseNumericLoose(primeCostRaw);
      if (primeCost == null) {
        result.errors.push({ rowIndex, sku, message: 'Prime Cost is required and must be numeric' });
        continue;
      }

      // Build payload — blank cells preserve existing DB value when SKU is
      // an UPDATE. For new SKUs, blank → null (or fail-fast for nameVi above).
      const sellingFromCsv = parseNumericLoose(sellingPriceRaw);
      const listingFromCsv = parseNumericLoose(listingPriceRaw);
      const nameEnFromCsv = nameEnRaw?.trim() ?? '';
      const payload = {
        productId: productId || existingRow?.productId || null,
        variationId: variationId || existingRow?.variationId || null,
        productNameVi: nameVi || existingRow?.productNameVi || '',
        productNameEn: nameEnFromCsv || existingRow?.productNameEn || null,
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
      };

      // Parse optional Effective From. Empty / missing → today.
      // Accept canonical YYYY-MM-DD plus Excel's auto-mangled M/D/YYYY (US)
      // and D/M/YYYY (VN). Round-tripping a CSV through Excel breaks the
      // canonical format — we try to recover here so users don't have to know.
      let effectiveFrom = today;
      if (effectiveFromRaw && effectiveFromRaw.trim()) {
        const trimmed = effectiveFromRaw.trim();
        const parsedDate = parseFlexibleDate(trimmed);
        if (!parsedDate) {
          result.errors.push({
            rowIndex,
            sku,
            message: `Effective From must be YYYY-MM-DD or M/D/YYYY (got "${trimmed}")`,
          });
          continue;
        }
        effectiveFrom = parsedDate;
      }

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
              pcsProductNameVi: payload.productNameVi,
              pcsProductNameEn: payload.productNameEn,
              pcsPrimeCostVnd: payload.primeCostVnd,
              pcsSellingPriceVnd: payload.sellingPriceVnd,
              pcsListingPriceVnd: payload.listingPriceVnd,
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
            pcsProductNameVi: payload.productNameVi,
            pcsProductNameEn: payload.productNameEn,
            pcsSkuCode: payload.skuCode,
            pcsPrimeCostVnd: payload.primeCostVnd,
            pcsSellingPriceVnd: payload.sellingPriceVnd,
            pcsListingPriceVnd: payload.listingPriceVnd,
            pcsCreatedBy: user.userId,
          });
          skuToId.set(sku, pcsId);
          result.inserted += 1;
        }

        // Always attempt to insert a version row. Conflict on (sku, effectiveFrom)
        // is silently skipped — same SKU + same date should not create a duplicate.
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
            // Real failure — surface to user
            result.errors.push({
              rowIndex,
              sku,
              message: `Version insert failed: ${vMsg}`,
            });
          }
          // Unique-conflict: same (sku, effectiveFrom) version already exists. Skip silently.
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
          `${result.versionsAdded} version(s) added` +
          (result.errors.length > 0 ? ` · Skipped ${result.errors.length}` : ''),
        metadata: {
          inserted: result.inserted,
          updated: result.updated,
          versionsAdded: result.versionsAdded,
          errors: result.errors.length,
        },
      });
    }

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

    return { ok: true };
  });
}
