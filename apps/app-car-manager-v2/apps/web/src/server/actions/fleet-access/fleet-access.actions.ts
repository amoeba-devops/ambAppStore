'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import {
  carUserFleetAccess,
  carFleetAccessRequests,
  carUsers,
} from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import {
  requestFleetAccessSchema,
  decideFleetAccessSchema,
  grantFleetAccessSchema,
  revokeFleetAccessSchema,
} from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { resolveFleetAccess } from '@/lib/auth/fleet-access';
import { logAudit } from '@/server/services/audit-log.service';
import { notifyUser, notifyMany } from '@/server/services/notification.service';
import { runAction } from '../_helpers';

const FLEET_ADMIN_PATHS = ['/settings/fleet-access', '/users'];
function revalidateFleetAdmin(): void {
  for (const p of FLEET_ADMIN_PATHS) revalidatePath(p);
}

/** Live (non-deleted) memberships for a user. */
async function liveMemberships(entId: string, userId: string) {
  return db
    .select({ type: carUserFleetAccess.ufaVehicleType })
    .from(carUserFleetAccess)
    .where(
      and(
        eq(carUserFleetAccess.entId, entId),
        eq(carUserFleetAccess.usrId, userId),
        isNull(carUserFleetAccess.ufaDeletedAt),
      ),
    );
}

/* ─────────────────────────────────────────────────────────────────────────
 * MANAGER — request access to a second department.
 * ──────────────────────────────────────────────────────────────────────── */
export async function requestFleetAccessAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    /* Admins already have both; drivers are fixed to one — only managers
     * expand from 1 → 2 via this flow. */
    requireRole(actor.role, ['MANAGER']);
    const dto = requestFleetAccessSchema.parse(input);

    const current = await resolveFleetAccess(actor);
    if (current.includes(dto.vehicleType)) {
      throw new CarError('CAR-E0409', 409, `You already have ${dto.vehicleType} access`);
    }

    /* Block duplicate open requests for the same department. */
    const pending = await db.query.carFleetAccessRequests.findFirst({
      where: and(
        eq(carFleetAccessRequests.entId, actor.entId),
        eq(carFleetAccessRequests.usrId, actor.userId),
        eq(carFleetAccessRequests.farVehicleType, dto.vehicleType),
        eq(carFleetAccessRequests.farStatus, 'PENDING'),
      ),
    });
    if (pending) {
      throw new CarError('CAR-E0409', 409, 'A pending request already exists');
    }

    const farId = randomUUID();
    await db.insert(carFleetAccessRequests).values({
      farId,
      entId: actor.entId,
      usrId: actor.userId,
      farVehicleType: dto.vehicleType,
      farReason: dto.reason ?? null,
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'FLEET.ACCESS_REQUESTED',
      entity: 'User',
      entityId: actor.userId,
      entityRef: actor.name ?? actor.email ?? actor.userId,
      after: { vehicleType: dto.vehicleType, reason: dto.reason ?? null },
    });

    /* Notify all admins so someone can approve. In-app stub (no template yet). */
    const admins = await db
      .select({ id: carUsers.usrId })
      .from(carUsers)
      .where(
        and(
          eq(carUsers.entId, actor.entId),
          eq(carUsers.usrLocalRole, 'ADMIN'),
          isNull(carUsers.usrDeletedAt),
        ),
      );
    if (admins.length > 0) {
      await notifyMany(
        admins.map((a) => a.id),
        {
          entId: actor.entId,
          event: 'FLEET.ACCESS_REQUESTED',
          title: 'Fleet access request',
          body: `${actor.name ?? actor.email ?? 'A manager'} requested ${dto.vehicleType} access`,
          entityId: farId,
        },
      );
    }

    revalidateFleetAdmin();
    return { ok: true as const };
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADMIN — approve / reject a pending request.
 * neon-http has no interactive transaction: insert membership first
 * (idempotent), then flip the request. Re-running an approve is safe.
 * ──────────────────────────────────────────────────────────────────────── */
export async function decideFleetAccessAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = decideFleetAccessSchema.parse(input);

    const req = await db.query.carFleetAccessRequests.findFirst({
      where: and(
        eq(carFleetAccessRequests.farId, dto.requestId),
        eq(carFleetAccessRequests.entId, actor.entId),
      ),
    });
    if (!req) throw new CarError('CAR-E0404', 404, 'Request not found');
    if (req.farStatus !== 'PENDING') {
      throw new CarError('CAR-E0409', 409, 'Request already decided');
    }

    if (dto.decision === 'APPROVED') {
      const existing = await liveMemberships(req.entId, req.usrId);
      if (!existing.some((m) => m.type === req.farVehicleType)) {
        await db.insert(carUserFleetAccess).values({
          ufaId: randomUUID(),
          entId: req.entId,
          usrId: req.usrId,
          ufaVehicleType: req.farVehicleType,
          ufaGrantedBy: actor.userId,
        });
      }
    }

    const [updated] = await db
      .update(carFleetAccessRequests)
      .set({
        farStatus: dto.decision,
        farDecidedBy: actor.userId,
        farDecidedAt: new Date(),
        farDecisionNote: dto.note ?? null,
      })
      .where(
        and(
          eq(carFleetAccessRequests.farId, dto.requestId),
          eq(carFleetAccessRequests.entId, actor.entId),
          eq(carFleetAccessRequests.farStatus, 'PENDING'),
        ),
      )
      .returning({ id: carFleetAccessRequests.farId });
    if (!updated) throw new CarError('CAR-E0409', 409, 'Request already decided');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: dto.decision === 'APPROVED' ? 'FLEET.ACCESS_APPROVED' : 'FLEET.ACCESS_REJECTED',
      entity: 'User',
      entityId: req.usrId,
      entityRef: req.usrId,
      after: { vehicleType: req.farVehicleType, note: dto.note ?? null },
    });

    await notifyUser({
      entId: req.entId,
      userId: req.usrId,
      event: dto.decision === 'APPROVED' ? 'FLEET.ACCESS_APPROVED' : 'FLEET.ACCESS_REJECTED',
      title: dto.decision === 'APPROVED' ? 'Fleet access approved' : 'Fleet access rejected',
      body: `Your ${req.farVehicleType} access request was ${dto.decision.toLowerCase()}`,
      entityId: req.farId,
    });

    revalidateFleetAdmin();
    return { ok: true as const };
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADMIN — directly grant a department to a user.
 * ──────────────────────────────────────────────────────────────────────── */
export async function grantFleetAccessAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = grantFleetAccessSchema.parse(input);

    const target = await db.query.carUsers.findFirst({
      where: and(
        eq(carUsers.usrId, dto.userId),
        eq(carUsers.entId, actor.entId),
        isNull(carUsers.usrDeletedAt),
      ),
    });
    if (!target) throw new CarError('CAR-E0404', 404, 'User not found');

    const existing = await liveMemberships(actor.entId, dto.userId);
    if (existing.some((m) => m.type === dto.vehicleType)) {
      throw new CarError('CAR-E0409', 409, 'User already has this department');
    }
    /* DRIVER is limited to exactly one department. */
    if (target.usrLocalRole === 'DRIVER' && existing.length >= 1) {
      throw new CarError('CAR-E0409', 409, 'A driver can belong to only one department');
    }

    await db.insert(carUserFleetAccess).values({
      ufaId: randomUUID(),
      entId: actor.entId,
      usrId: dto.userId,
      ufaVehicleType: dto.vehicleType,
      ufaGrantedBy: actor.userId,
    });

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'FLEET.ACCESS_GRANTED',
      entity: 'User',
      entityId: dto.userId,
      entityRef: target.usrName ?? target.usrEmail ?? dto.userId,
      after: { vehicleType: dto.vehicleType },
    });

    await notifyUser({
      entId: actor.entId,
      userId: dto.userId,
      event: 'FLEET.ACCESS_GRANTED',
      title: 'Fleet access granted',
      body: `You were granted ${dto.vehicleType} access`,
    });

    revalidateFleetAdmin();
    return { ok: true as const };
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADMIN — revoke a department from a user (soft-delete the membership).
 * ──────────────────────────────────────────────────────────────────────── */
export async function revokeFleetAccessAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = revokeFleetAccessSchema.parse(input);

    const [revoked] = await db
      .update(carUserFleetAccess)
      .set({ ufaDeletedAt: new Date() })
      .where(
        and(
          eq(carUserFleetAccess.entId, actor.entId),
          eq(carUserFleetAccess.usrId, dto.userId),
          eq(carUserFleetAccess.ufaVehicleType, dto.vehicleType),
          isNull(carUserFleetAccess.ufaDeletedAt),
        ),
      )
      .returning({ id: carUserFleetAccess.ufaId });
    if (!revoked) throw new CarError('CAR-E0404', 404, 'Membership not found');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'FLEET.ACCESS_REVOKED',
      entity: 'User',
      entityId: dto.userId,
      entityRef: dto.userId,
      before: { vehicleType: dto.vehicleType },
    });

    await notifyUser({
      entId: actor.entId,
      userId: dto.userId,
      event: 'FLEET.ACCESS_REVOKED',
      title: 'Fleet access revoked',
      body: `Your ${dto.vehicleType} access was revoked`,
    });

    revalidateFleetAdmin();
    return { ok: true as const };
  });
}
