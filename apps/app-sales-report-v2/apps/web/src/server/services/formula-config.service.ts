import 'server-only';
import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '@v2/db';
import {
  FORMULA_PARAM_REGISTRY,
  type FormulaConfigSnapshot,
  type FormulaParamSpec,
  type FormulaValueType,
} from '@v2/shared';

/**
 * Load the active formula-config snapshot for an entity at a point in time.
 *
 * Resolution rules (mirrors `sal_fx_rates` pattern):
 *   1. For each registered key, query rows where ent_id IN (entId, NULL)
 *      AND ffc_effective_from ≤ asOf AND ffc_deleted_at IS NULL.
 *   2. Per-entity row wins over global default (NULL ent_id) when both exist.
 *   3. Among multiple matching rows, pick the one with the latest
 *      ffc_effective_from.
 *   4. If no row matches, fall back to `registry.defaultValue`.
 *
 * Output covers every key in the registry — consumers can safely subscript
 * any registered key without null-checking.
 */
export async function loadFormulaConfig(
  entId: string,
  asOf: Date = new Date(),
): Promise<FormulaConfigSnapshot> {
  const rows = await db
    .select({
      ffcKey: schema.salFormulaConfigs.ffcKey,
      ffcValue: schema.salFormulaConfigs.ffcValue,
      ffcValueType: schema.salFormulaConfigs.ffcValueType,
      ffcEffectiveFrom: schema.salFormulaConfigs.ffcEffectiveFrom,
      entId: schema.salFormulaConfigs.entId,
    })
    .from(schema.salFormulaConfigs)
    .where(
      and(
        or(
          eq(schema.salFormulaConfigs.entId, entId),
          isNull(schema.salFormulaConfigs.entId),
        ),
        lte(schema.salFormulaConfigs.ffcEffectiveFrom, asOf),
        isNull(schema.salFormulaConfigs.ffcDeletedAt),
      ),
    )
    .orderBy(desc(schema.salFormulaConfigs.ffcEffectiveFrom));

  // For each key, pick the best row: per-ent wins over global; within same
  // scope, latest effective_from wins. `rows` already ordered DESC by date,
  // so first encounter for any (key, scope) is the active one.
  const perEntPicked = new Map<string, (typeof rows)[number]>();
  const globalPicked = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (r.entId === entId && !perEntPicked.has(r.ffcKey)) {
      perEntPicked.set(r.ffcKey, r);
    } else if (r.entId == null && !globalPicked.has(r.ffcKey)) {
      globalPicked.set(r.ffcKey, r);
    }
  }

  const out: FormulaConfigSnapshot = {};
  for (const spec of Object.values(FORMULA_PARAM_REGISTRY)) {
    const row = perEntPicked.get(spec.key) ?? globalPicked.get(spec.key);
    if (row) {
      out[spec.key] = {
        value: row.ffcValue,
        valueType: row.ffcValueType as FormulaValueType,
        effectiveFrom: row.ffcEffectiveFrom.toISOString(),
      };
    } else {
      // Fall back to registry default — DB hasn't been seeded for this key yet.
      out[spec.key] = {
        value: spec.defaultValue,
        valueType: spec.valueType,
        effectiveFrom: '1970-01-01T00:00:00.000Z',
      };
    }
  }
  return out;
}

/**
 * List all version rows for one key — used by the "History" drawer in the UI.
 * Includes soft-deleted rows so Admin can see the full audit trail (deleted
 * versions visually flagged in the UI).
 */
export async function listFormulaConfigVersions(
  entId: string,
  key: string,
  limit: number = 50,
): Promise<
  Array<{
    ffcId: string;
    entId: string | null;
    value: string;
    valueType: FormulaValueType;
    effectiveFrom: string;
    sourceNote: string | null;
    createdBy: string | null;
    createdAt: string;
    deletedAt: string | null;
  }>
> {
  const rows = await db
    .select({
      ffcId: schema.salFormulaConfigs.ffcId,
      entId: schema.salFormulaConfigs.entId,
      ffcValue: schema.salFormulaConfigs.ffcValue,
      ffcValueType: schema.salFormulaConfigs.ffcValueType,
      ffcEffectiveFrom: schema.salFormulaConfigs.ffcEffectiveFrom,
      ffcSourceNote: schema.salFormulaConfigs.ffcSourceNote,
      ffcCreatedBy: schema.salFormulaConfigs.ffcCreatedBy,
      ffcCreatedAt: schema.salFormulaConfigs.ffcCreatedAt,
      ffcDeletedAt: schema.salFormulaConfigs.ffcDeletedAt,
    })
    .from(schema.salFormulaConfigs)
    .where(
      and(
        eq(schema.salFormulaConfigs.ffcKey, key),
        or(
          eq(schema.salFormulaConfigs.entId, entId),
          isNull(schema.salFormulaConfigs.entId),
        ),
      ),
    )
    .orderBy(desc(schema.salFormulaConfigs.ffcEffectiveFrom))
    .limit(limit);

  return rows.map((r) => ({
    ffcId: r.ffcId,
    entId: r.entId,
    value: r.ffcValue,
    valueType: r.ffcValueType as FormulaValueType,
    effectiveFrom: r.ffcEffectiveFrom.toISOString(),
    sourceNote: r.ffcSourceNote,
    createdBy: r.ffcCreatedBy,
    createdAt: r.ffcCreatedAt.toISOString(),
    deletedAt: r.ffcDeletedAt ? r.ffcDeletedAt.toISOString() : null,
  }));
}

/**
 * Convenience helper to get the spec for a key. Throws if unknown — used by
 * the server action to reject writes to unregistered keys.
 */
export function getFormulaParamSpec(key: string): FormulaParamSpec {
  const spec = FORMULA_PARAM_REGISTRY[key];
  if (!spec) throw new Error(`Unknown formula param key: ${key}`);
  return spec;
}

// Re-export sql for downstream callers that need raw fragments (kept off the
// public API surface — internal use only).
export { sql as _sqlInternal };
