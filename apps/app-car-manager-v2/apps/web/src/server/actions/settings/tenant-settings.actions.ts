'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTenantSettings, type CarTenantSettings } from '@car-v2/db/schema';
import { type ActionResult } from '@car-v2/shared/errors';
import {
  updateCurrencySchema,
  updateNotifPrefSchema,
  updateRetentionSchema,
  updateTenantNameSchema,
  updateTimezoneSchema,
} from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import {
  assertAuditRetentionAllowed,
  assertTimezoneAllowed,
  assertTripRetentionAllowed,
  getOrSeedTenantSettings,
} from '@/server/services/tenant-settings.service';
import { runAction } from '../_helpers';

/* All settings mutations go through these actions. Each:
 *   1. requireRole(ADMIN) — Manager/Driver get CAR-E0102.
 *   2. Zod-validate the input envelope.
 *   3. Service-layer allowlist for free-text fields (timezone, retention years).
 *   4. UPDATE on the singleton row (lazy-seeded if missing).
 *   5. Audit log SETTINGS.UPDATE with {field, before, after} payload.
 *   6. revalidatePath('/settings') so a hard refresh re-reads DB.
 */

async function loadCurrentRow(entId: string, userId: string): Promise<CarTenantSettings> {
  return getOrSeedTenantSettings(entId, userId);
}

async function persistAndAudit(
  entId: string,
  userId: string,
  field: string,
  before: unknown,
  after: unknown,
  patch: Partial<typeof carTenantSettings.$inferInsert>,
): Promise<CarTenantSettings> {
  const updated = await db
    .update(carTenantSettings)
    .set({ ...patch, tnsUpdatedAt: new Date(), tnsUpdatedBy: userId })
    .where(eq(carTenantSettings.entId, entId))
    .returning();
  if (!updated[0]) {
    throw new Error('Update returned no row');
  }
  await logAudit({
    entId,
    userId,
    action: 'SETTINGS.UPDATE',
    entity: 'System',
    entityId: updated[0].tnsId,
    before: { field, value: before },
    after: { field, value: after },
  });
  revalidatePath('/settings');
  return updated[0];
}

/* ─── Tenant name ─────────────────────────────────────────────────────── */
export async function updateTenantNameAction(
  input: unknown,
): Promise<ActionResult<CarTenantSettings>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const data = updateTenantNameSchema.parse(input);
    const current = await loadCurrentRow(actor.entId, actor.userId);
    /* Empty string → store NULL to "clear back to default". */
    const normalized = data.tenant_name === '' ? null : data.tenant_name;
    return persistAndAudit(
      actor.entId,
      actor.userId,
      'tenantName',
      current.tnsTenantName,
      normalized,
      { tnsTenantName: normalized },
    );
  });
}

/* ─── Currency ────────────────────────────────────────────────────────── */
export async function updateCurrencyAction(
  input: unknown,
): Promise<ActionResult<CarTenantSettings>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const data = updateCurrencySchema.parse(input);
    const current = await loadCurrentRow(actor.entId, actor.userId);
    return persistAndAudit(
      actor.entId,
      actor.userId,
      'currency',
      current.tnsCurrency,
      data.currency,
      { tnsCurrency: data.currency },
    );
  });
}

/* ─── Timezone ────────────────────────────────────────────────────────── */
export async function updateTimezoneAction(
  input: unknown,
): Promise<ActionResult<CarTenantSettings>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const data = updateTimezoneSchema.parse(input);
    assertTimezoneAllowed(data.timezone);
    const current = await loadCurrentRow(actor.entId, actor.userId);
    return persistAndAudit(
      actor.entId,
      actor.userId,
      'timezone',
      current.tnsTimezone,
      data.timezone,
      { tnsTimezone: data.timezone },
    );
  });
}

/* ─── Notification preferences ────────────────────────────────────────── */
export async function updateNotifPrefAction(
  input: unknown,
): Promise<ActionResult<CarTenantSettings>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const data = updateNotifPrefSchema.parse(input);
    const current = await loadCurrentRow(actor.entId, actor.userId);

    const FIELD_MAP = {
      inapp: { col: 'tnsNotifInapp' as const, prev: current.tnsNotifInapp },
      email: { col: 'tnsNotifEmail' as const, prev: current.tnsNotifEmail },
      digest: { col: 'tnsNotifDigest' as const, prev: current.tnsNotifDigest },
    };
    const target = FIELD_MAP[data.field];

    return persistAndAudit(
      actor.entId,
      actor.userId,
      `notif.${data.field}`,
      target.prev,
      data.value,
      { [target.col]: data.value },
    );
  });
}

/* ─── Retention ───────────────────────────────────────────────────────── */
export async function updateRetentionAction(
  input: unknown,
): Promise<ActionResult<CarTenantSettings>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const data = updateRetentionSchema.parse(input);
    const current = await loadCurrentRow(actor.entId, actor.userId);

    if (data.field === 'trip') {
      if (data.years === null) {
        /* Trip retention cannot be NULL — UI never offers it. */
        throw new Error('trip retention requires a year value');
      }
      assertTripRetentionAllowed(data.years);
      return persistAndAudit(
        actor.entId,
        actor.userId,
        'retention.trip',
        current.tnsRetentionTripYears,
        data.years,
        { tnsRetentionTripYears: data.years },
      );
    }

    // audit
    assertAuditRetentionAllowed(data.years);
    return persistAndAudit(
      actor.entId,
      actor.userId,
      'retention.audit',
      current.tnsRetentionAuditYears,
      data.years,
      { tnsRetentionAuditYears: data.years },
    );
  });
}
