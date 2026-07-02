'use server';

import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, schema } from '@v2/db';
import {
  FORMULA_PARAM_REGISTRY,
  validateFormulaValue,
  type FormulaConfigSnapshot,
} from '@v2/shared';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import {
  loadFormulaConfig,
  listFormulaConfigVersions,
} from '@/server/services/formula-config.service';
import { logAction } from '@/server/services/action-log.service';

const updateInputSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  effectiveFrom: z.string().datetime().optional(),
  sourceNote: z.string().max(255).optional(),
});

export type UpdateFormulaConfigResult = ActionResult<{
  ffcId: string;
  effectiveFrom: string;
}>;

/**
 * Admin updates a formula param. Always INSERTs a new row (never UPDATEs in
 * place) so versioning + audit trail are preserved.
 */
export async function updateFormulaConfigAction(
  input: z.infer<typeof updateInputSchema>,
): Promise<UpdateFormulaConfigResult> {
  try {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);

    const parsed = updateInputSchema.parse(input);
    const spec = FORMULA_PARAM_REGISTRY[parsed.key];
    if (!spec) {
      return {
        success: false,
        error: { code: 'SAL-E0404', message: `Unknown formula key: ${parsed.key}` },
      };
    }

    let normalizedValue: string;
    try {
      normalizedValue = validateFormulaValue(spec, parsed.value);
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'SAL-E0400',
          message: err instanceof Error ? err.message : 'Invalid value',
        },
      };
    }

    const ffcId = randomUUID();
    const effectiveFrom = parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : new Date();

    await db.insert(schema.salFormulaConfigs).values({
      ffcId,
      entId: user.entId,
      ffcKey: parsed.key,
      ffcValue: normalizedValue,
      ffcValueType: spec.valueType,
      ffcUnit: spec.unit,
      ffcEffectiveFrom: effectiveFrom,
      ffcSourceNote: parsed.sourceNote,
      ffcCreatedBy: user.userId,
    });

    await logAction({
      user,
      category: 'OTHER',
      verb: 'updated',
      targetType: 'formula_config',
      targetId: parsed.key,
      targetLabel: spec.displayName,
      summary: `${spec.displayName} → ${normalizedValue}${spec.unit ?? ''} (effective ${effectiveFrom.toISOString().slice(0, 10)})`,
      metadata: {
        key: parsed.key,
        value: normalizedValue,
        valueType: spec.valueType,
        effectiveFrom: effectiveFrom.toISOString(),
        sourceNote: parsed.sourceNote,
      },
    });

    return {
      success: true,
      data: { ffcId, effectiveFrom: effectiveFrom.toISOString() },
    };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: { code: 'SAL-E0400', message: err.errors.map((e) => e.message).join(', ') },
      };
    }
    console.error('[formula-config.update]', err);
    return { success: false, error: { code: 'SAL-E0500', message: 'Internal error' } };
  }
}

export type LoadFormulaConfigResult = ActionResult<FormulaConfigSnapshot>;

/**
 * Read-only: load current active formula config for the calling user's entity.
 * Used by the Formula Config UI to render current values.
 */
export async function loadFormulaConfigAction(): Promise<LoadFormulaConfigResult> {
  try {
    const user = await getCurrentUser();
    const snapshot = await loadFormulaConfig(user.entId, new Date());
    return { success: true, data: snapshot };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error('[formula-config.load]', err);
    return { success: false, error: { code: 'SAL-E0500', message: 'Internal error' } };
  }
}

const listVersionsInputSchema = z.object({
  key: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

export type FormulaConfigVersionRow = {
  ffcId: string;
  entId: string | null;
  value: string;
  valueType: string;
  effectiveFrom: string;
  sourceNote: string | null;
  createdBy: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type ListFormulaConfigVersionsResult = ActionResult<FormulaConfigVersionRow[]>;

/** History drawer — list all versions for a single key, latest first. */
export async function listFormulaConfigVersionsAction(
  input: z.infer<typeof listVersionsInputSchema>,
): Promise<ListFormulaConfigVersionsResult> {
  try {
    const user = await getCurrentUser();
    const parsed = listVersionsInputSchema.parse(input);
    const spec = FORMULA_PARAM_REGISTRY[parsed.key];
    if (!spec) {
      return {
        success: false,
        error: { code: 'SAL-E0404', message: `Unknown formula key: ${parsed.key}` },
      };
    }
    const rows = await listFormulaConfigVersions(user.entId, parsed.key, parsed.limit);
    return { success: true, data: rows };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: { code: 'SAL-E0400', message: err.errors.map((e) => e.message).join(', ') },
      };
    }
    console.error('[formula-config.listVersions]', err);
    return { success: false, error: { code: 'SAL-E0500', message: 'Internal error' } };
  }
}
