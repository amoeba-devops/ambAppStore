import 'server-only';
import { evaluateAssignmentWarnings, type EvaluateAssignmentInput } from '@car-v2/core';
import {
  CarError,
  CONFIRM_REQUIRED_CODE,
  type AssignmentWarning,
} from '@car-v2/shared/errors';
import type { AuthContext } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';

/**
 * Assignment-guard pattern, action-layer half (see
 * @car-v2/shared/errors/assignment-guard for the contract):
 *
 *   1. Evaluate warnings for the driver/vehicle pairing.
 *   2. No warnings → proceed.
 *   3. Warnings + actor is DRIVER → hard refuse (a driver can't override
 *      their own double-booking; complete the open trip first).
 *   4. Warnings not all confirmed → refuse with CONFIRM_REQUIRED_CODE +
 *      `details.warnings`; the client shows the confirm dialog and resubmits
 *      with `confirmed_warning_codes`.
 *   5. All warnings confirmed → return them; caller MUST pass the list to
 *      `auditGuardOverride` after the mutation succeeds.
 *
 * Confirmation is code-based, not a blanket boolean: the server re-evaluates
 * on every submit, so a warning that appears between the dialog and the retry
 * still stops the save.
 */
export async function ensureAssignmentConfirmed(
  actor: AuthContext,
  input: EvaluateAssignmentInput,
  confirmedCodes: string[] | undefined,
): Promise<AssignmentWarning[]> {
  const warnings = await evaluateAssignmentWarnings(actor.entId, input);
  if (warnings.length === 0) return [];

  if (actor.role === 'DRIVER') {
    const first = warnings[0]!;
    throw new CarError(
      'CAR-E1009',
      409,
      first.code === 'DRIVER_ON_ACTIVE_TRIP'
        ? `Driver is already on active trip(s) ${(first.refs ?? []).join(', ')}`
        : `Driver is not available for assignment (${first.status ?? first.code})`,
      { warnings },
    );
  }

  const confirmed = new Set(confirmedCodes ?? []);
  const unconfirmed = warnings.filter((w) => !confirmed.has(w.code));
  if (unconfirmed.length > 0) {
    throw new CarError(CONFIRM_REQUIRED_CODE, 409, 'Confirmation required', { warnings });
  }
  return warnings;
}

/** Audit trail for a save that went through despite confirmed warnings. */
export async function auditGuardOverride(
  actor: AuthContext,
  trip: { trpId: string; trpRef: string },
  overriddenWarnings: AssignmentWarning[],
): Promise<void> {
  if (overriddenWarnings.length === 0) return;
  await logAudit({
    entId: actor.entId,
    userId: actor.userId,
    action: 'TRIP.GUARD_OVERRIDDEN',
    entity: 'Trip',
    entityId: trip.trpId,
    entityRef: trip.trpRef,
    after: {
      warnings: overriddenWarnings.map((w) => ({
        code: w.code,
        refs: w.refs,
        status: w.status,
        plate: w.plate,
      })),
    },
  });
}
