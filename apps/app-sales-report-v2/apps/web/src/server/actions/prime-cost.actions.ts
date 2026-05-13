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
};

function rowFromDb(r: typeof schema.salPrimeCosts.$inferSelect): PrimeCostRow {
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

    return {
      rows: rows.map(rowFromDb),
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

    const csvRows = rows.map((r) => [
      excelTextCell(r.pcsProductId),
      excelTextCell(r.pcsVariationId),
      r.pcsProductNameVi,
      r.pcsProductNameEn ?? '',
      excelTextCell(r.pcsSkuCode),
      Number(r.pcsPrimeCostVnd),
      r.pcsSellingPriceVnd != null ? Number(r.pcsSellingPriceVnd) : '',
      r.pcsListingPriceVnd != null ? Number(r.pcsListingPriceVnd) : '',
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
  errors: Array<{ rowIndex: number; sku?: string; message: string }>;
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

    // Load existing SKU → pcsId map for upsert
    const existing = await db
      .select({ pcsId: schema.salPrimeCosts.pcsId, sku: schema.salPrimeCosts.pcsSkuCode })
      .from(schema.salPrimeCosts)
      .where(and(withEnt(schema.salPrimeCosts.entId, user.entId), SOFT_DELETED));
    const skuToId = new Map(existing.map((e) => [e.sku, e.pcsId]));

    const result: ImportResult = { inserted: 0, updated: 0, errors: [] };

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
      ] = row;

      const productId = productIdRaw ? stripExcelTextWrapper(productIdRaw) : '';
      const variationId = variationIdRaw ? stripExcelTextWrapper(variationIdRaw) : '';
      const sku = stripExcelTextWrapper(skuRaw ?? '');
      const nameVi = (nameViRaw ?? '').trim();

      if (!sku) {
        result.errors.push({ rowIndex, message: 'SKU is required' });
        continue;
      }
      if (!nameVi) {
        result.errors.push({ rowIndex, sku, message: 'Product (VI) is required' });
        continue;
      }
      // Detect Excel-corrupted IDs (long numeric → scientific notation lost precision)
      if (productId && looksLikeScientificNotation(productId)) {
        result.errors.push({
          rowIndex,
          sku,
          message: `Product ID "${productId}" looks like scientific notation — Excel lost precision. Re-format the source column as Text and re-export.`,
        });
        continue;
      }
      if (variationId && looksLikeScientificNotation(variationId)) {
        result.errors.push({
          rowIndex,
          sku,
          message: `Variation ID "${variationId}" looks like scientific notation — Excel lost precision. Re-format the source column as Text and re-export.`,
        });
        continue;
      }

      const primeCost = parseNumericLoose(primeCostRaw);
      if (primeCost == null) {
        result.errors.push({ rowIndex, sku, message: 'Prime Cost is required and must be numeric' });
        continue;
      }

      const payload = {
        productId: productId || null,
        variationId: variationId || null,
        productNameVi: nameVi,
        productNameEn: nameEnRaw?.trim() || null,
        skuCode: sku,
        primeCostVnd: primeCost.toString(),
        sellingPriceVnd: parseNumericLoose(sellingPriceRaw)?.toString() ?? null,
        listingPriceVnd: parseNumericLoose(listingPriceRaw)?.toString() ?? null,
      };

      try {
        const existingId = skuToId.get(sku);
        if (existingId) {
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
          const pcsId = randomUUID();
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
        summary: `Inserted ${result.inserted} · Updated ${result.updated}` +
          (result.errors.length > 0 ? ` · Skipped ${result.errors.length}` : ''),
        metadata: { inserted: result.inserted, updated: result.updated, errors: result.errors.length },
      });
    }

    return result;
  });
}
