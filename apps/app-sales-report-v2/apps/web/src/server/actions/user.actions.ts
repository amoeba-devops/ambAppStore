'use server';

import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema, withEnt } from '@v2/db';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { mapAmaRoleToLocal } from '@v2/shared/auth';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { logAction } from '@/server/services/action-log.service';
import { createAmaClient } from '@/server/services/ama-client.service';

const LOCAL_ROLES = ['OPERATOR', 'MANAGER', 'ADMIN'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

/** Role union widened with `UNASSIGNED` for display-only — AMA members synced
 *  into the app but not yet granted any local role by an Admin. */
export type UserRowRole = (typeof LOCAL_ROLES)[number] | 'UNASSIGNED';

export type UserRow = {
  usrId: string;
  amaUserId: string;
  email: string | null;
  name: string | null;
  role: UserRowRole;
  amaRoleSnapshot: string | null;
  status: (typeof STATUSES)[number];
  loginCount: number;
  mfaLastAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

function rowFromDb(r: typeof schema.salUsers.$inferSelect): UserRow {
  return {
    usrId: r.usrId,
    amaUserId: r.usrAmaUserId,
    email: r.usrEmail,
    name: r.usrName,
    role: r.usrLocalRole,
    amaRoleSnapshot: r.usrAmaRoleSnapshot,
    status: r.usrStatus,
    loginCount: r.usrLoginCount,
    mfaLastAt: r.usrMfaLastAt?.toISOString() ?? null,
    lastLoginAt: r.usrLastLoginAt?.toISOString() ?? null,
    createdAt: r.usrCreatedAt.toISOString(),
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
    if (msg.includes('duplicate key') || msg.includes('uniq_sal_users_ent_ama')) {
      return { success: false, error: { code: 'SAL-E0060', message: 'User already exists in this entity' } };
    }
    console.error('[user.action]', err);
    return { success: false, error: { code: 'SAL-E0500', message: 'Internal error' } };
  }
}

const listInputSchema = z.object({
  search: z.string().optional(),
  role: z.enum([...LOCAL_ROLES, 'ALL']).optional(),
  status: z.enum([...STATUSES, 'ALL']).optional(),
});

export async function listUsersAction(input: z.infer<typeof listInputSchema> = {}) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);
    const parsed = listInputSchema.parse(input);

    const conditions: SQL[] = [
      withEnt(schema.salUsers.entId, user.entId),
      isNull(schema.salUsers.usrDeletedAt),
    ];
    const search = parsed.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(schema.salUsers.usrName, pattern),
          ilike(schema.salUsers.usrEmail, pattern),
        )!,
      );
    }
    if (parsed.role && parsed.role !== 'ALL') {
      conditions.push(eq(schema.salUsers.usrLocalRole, parsed.role));
    }
    if (parsed.status && parsed.status !== 'ALL') {
      conditions.push(eq(schema.salUsers.usrStatus, parsed.status));
    }

    const rows = await db
      .select()
      .from(schema.salUsers)
      .where(and(...conditions))
      .orderBy(asc(schema.salUsers.usrName))
      .limit(200);

    return { rows: rows.map(rowFromDb), currentUserId: user.userId };
  });
}

const updateUserSchema = z.object({
  usrId: z.string().uuid(),
  name: z.string().min(1).max(255).optional().nullable(),
  role: z.enum(LOCAL_ROLES),
});

export async function updateUserAction(input: z.infer<typeof updateUserSchema>) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);
    const parsed = updateUserSchema.parse(input);

    const before = await db
      .select()
      .from(schema.salUsers)
      .where(and(withEnt(schema.salUsers.entId, user.entId), eq(schema.salUsers.usrId, parsed.usrId)))
      .limit(1);
    if (!before[0]) throw new SalError('SAL-E0404', 404, 'User not found');

    const result = await db
      .update(schema.salUsers)
      .set({
        usrName: parsed.name ?? before[0].usrName,
        usrLocalRole: parsed.role,
        usrUpdatedAt: new Date(),
      })
      .where(and(withEnt(schema.salUsers.entId, user.entId), eq(schema.salUsers.usrId, parsed.usrId)))
      .returning();
    if (!result[0]) throw new SalError('SAL-E0404', 404, 'User not found');

    await logAction({
      user,
      category: 'OTHER',
      verb: before[0].usrLocalRole !== parsed.role ? 'changed role' : 'updated',
      targetType: 'user',
      targetId: parsed.usrId,
      targetLabel: `User: ${result[0].usrName ?? result[0].usrEmail ?? parsed.usrId}`,
      summary:
        before[0].usrLocalRole !== parsed.role
          ? `Role: ${before[0].usrLocalRole} → ${parsed.role}`
          : `Name updated`,
      before: { role: before[0].usrLocalRole, name: before[0].usrName },
      after: { role: parsed.role, name: parsed.name ?? before[0].usrName },
    });
    return { usrId: parsed.usrId };
  });
}

const statusInputSchema = z.object({ usrId: z.string().uuid() });

export async function deactivateUserAction(input: z.infer<typeof statusInputSchema>) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);
    const parsed = statusInputSchema.parse(input);
    // Load the target row first so we can compare its AMA user id (not the
    // local PK) against the caller's AMA sub.
    const target = await db
      .select({ usrAmaUserId: schema.salUsers.usrAmaUserId })
      .from(schema.salUsers)
      .where(
        and(
          withEnt(schema.salUsers.entId, user.entId),
          eq(schema.salUsers.usrId, parsed.usrId),
        ),
      )
      .limit(1);
    if (target[0]?.usrAmaUserId === user.userId) {
      throw new SalError('SAL-E0061', 400, 'Cannot deactivate your own account');
    }
    const result = await db
      .update(schema.salUsers)
      .set({ usrStatus: 'INACTIVE', usrUpdatedAt: new Date() })
      .where(
        and(
          withEnt(schema.salUsers.entId, user.entId),
          eq(schema.salUsers.usrId, parsed.usrId),
        ),
      )
      .returning();
    if (!result[0]) throw new SalError('SAL-E0404', 404, 'User not found');
    await logAction({
      user,
      category: 'OTHER',
      verb: 'deactivated',
      targetType: 'user',
      targetId: parsed.usrId,
      targetLabel: `User: ${result[0].usrName ?? result[0].usrEmail ?? parsed.usrId}`,
    });
    return { usrId: parsed.usrId };
  });
}

export async function activateUserAction(input: z.infer<typeof statusInputSchema>) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);
    const parsed = statusInputSchema.parse(input);
    const result = await db
      .update(schema.salUsers)
      .set({ usrStatus: 'ACTIVE', usrUpdatedAt: new Date() })
      .where(
        and(
          withEnt(schema.salUsers.entId, user.entId),
          eq(schema.salUsers.usrId, parsed.usrId),
        ),
      )
      .returning();
    if (!result[0]) throw new SalError('SAL-E0404', 404, 'User not found');
    await logAction({
      user,
      category: 'OTHER',
      verb: 'activated',
      targetType: 'user',
      targetId: parsed.usrId,
      targetLabel: `User: ${result[0].usrName ?? result[0].usrEmail ?? parsed.usrId}`,
    });
    return { usrId: parsed.usrId };
  });
}

export async function resetPasswordAction(_input: z.infer<typeof statusInputSchema>) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);
    // AMA owns authentication — we cannot reset passwords from this app.
    // This action just emits an audit log entry so admin's intent is recorded.
    await logAction({
      user,
      category: 'OTHER',
      verb: 'requested password reset',
      targetType: 'user',
      targetId: _input.usrId,
      targetLabel: `User password reset (AMA)`,
      summary: 'Direct user to reset at ama.amoeba.site — this app does not store passwords',
    });
    return { ok: true };
  });
}

const inviteInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
  role: z.enum(LOCAL_ROLES),
});

export interface SyncSummary {
  inserted: number;
  updated: number;
  deactivated: number;
  total: number;
}

/**
 * Bulk-sync entity members from AMA into sal_users.
 * - New AMA members → INSERT with mapped role + status=INACTIVE (admin reviews).
 * - Existing users → UPDATE name/email/ama_role_snapshot (preserve local role + status).
 * - Users no longer in AMA → set status=INACTIVE (never hard-delete; FK from action logs).
 * - Current admin is never auto-deactivated.
 *
 * Idempotent: running twice gives the same DB state.
 */
export async function syncFromAmaAction(): Promise<ActionResult<SyncSummary>> {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);

    const amaClient = createAmaClient();
    const amaMembers = await amaClient.fetchEntityMembers(user.entId);
    const amaIds = new Set(amaMembers.map((m) => m.amaUserId));

    const existing = await db
      .select()
      .from(schema.salUsers)
      .where(
        and(
          withEnt(schema.salUsers.entId, user.entId),
          isNull(schema.salUsers.usrDeletedAt),
        ),
      );
    const existingByAmaId = new Map(existing.map((u) => [u.usrAmaUserId, u]));

    let inserted = 0;
    let updated = 0;
    let deactivated = 0;

    for (const member of amaMembers) {
      const found = existingByAmaId.get(member.amaUserId);
      if (found) {
        await db
          .update(schema.salUsers)
          .set({
            usrEmail: member.email,
            usrName: member.name,
            usrAmaRoleSnapshot: member.amaRole,
            usrUpdatedAt: new Date(),
          })
          .where(eq(schema.salUsers.usrId, found.usrId));
        updated++;
      } else {
        await db
          .insert(schema.salUsers)
          .values({
            usrId: randomUUID(),
            entId: user.entId,
            usrAmaUserId: member.amaUserId,
            usrEmail: member.email,
            usrName: member.name,
            usrLocalRole: mapAmaRoleToLocal(member.amaRole),
            usrAmaRoleSnapshot: member.amaRole,
            usrStatus: 'INACTIVE',
          })
          .onConflictDoNothing();
        inserted++;
      }
    }

    for (const found of existing) {
      if (amaIds.has(found.usrAmaUserId)) continue;
      if (found.usrStatus === 'INACTIVE') continue;
      // Self-protect: user.userId is the AMA sub (claim from JWT), not the
      // local sal_users PK — compare against usrAmaUserId.
      if (found.usrAmaUserId === user.userId) continue;
      await db
        .update(schema.salUsers)
        .set({ usrStatus: 'INACTIVE', usrUpdatedAt: new Date() })
        .where(eq(schema.salUsers.usrId, found.usrId));
      deactivated++;
    }

    const summary: SyncSummary = {
      inserted,
      updated,
      deactivated,
      total: amaMembers.length,
    };

    await logAction({
      user,
      category: 'OTHER',
      verb: 'synced from AMA',
      targetType: 'user',
      targetId: 'bulk',
      targetLabel: 'AMA entity members',
      summary: `inserted ${inserted} · updated ${updated} · deactivated ${deactivated}`,
    });

    return summary;
  });
}

/**
 * Pre-register a user by email so they appear in the list with a chosen role
 * before their first AMA login. When the actual user signs in, ensureUserSynced
 * will match by email and link the real AMA user_id.
 *
 * NOTE: Since AMA is the source of identity, this only works if the email
 * matches the AMA-issued JWT claim. Treat as a "pre-stage" record.
 */
export async function inviteUserAction(input: z.infer<typeof inviteInputSchema>) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['ADMIN']);
    const parsed = inviteInputSchema.parse(input);

    const existing = await db
      .select({ usrId: schema.salUsers.usrId })
      .from(schema.salUsers)
      .where(
        and(withEnt(schema.salUsers.entId, user.entId), eq(schema.salUsers.usrEmail, parsed.email)),
      )
      .limit(1);
    if (existing[0]) {
      throw new SalError('SAL-E0062', 409, 'A user with this email already exists in this entity');
    }

    // Placeholder AMA user_id — will be reconciled on first login (TODO).
    const placeholderAmaId = `pending-${randomUUID()}`;
    const usrId = randomUUID();
    await db.insert(schema.salUsers).values({
      usrId,
      entId: user.entId,
      usrAmaUserId: placeholderAmaId,
      usrEmail: parsed.email,
      usrName: parsed.name ?? null,
      usrLocalRole: parsed.role,
    });
    await logAction({
      user,
      category: 'OTHER',
      verb: 'invited',
      targetType: 'user',
      targetId: usrId,
      targetLabel: `User: ${parsed.email}`,
      summary: `Role: ${parsed.role}`,
    });
    return { usrId };
  });
}

