'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carUserRegionAccess, carUsers } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { setRegionAccessSchema, revokeAllRegionAccessSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { notifyUser } from '@/server/services/notification.service';
import { runAction } from '../_helpers';

const REGION_ADMIN_PATHS = ['/settings/region-access', '/users'];
function revalidateRegionAdmin(): void {
  for (const p of REGION_ADMIN_PATHS) revalidatePath(p);
}

async function liveGrants(entId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ region: carUserRegionAccess.uraRegion })
    .from(carUserRegionAccess)
    .where(
      and(
        eq(carUserRegionAccess.entId, entId),
        eq(carUserRegionAccess.usrId, userId),
        isNull(carUserRegionAccess.uraDeletedAt),
      ),
    );
  return rows.map((r) => r.region);
}

async function loadTarget(entId: string, userId: string) {
  const target = await db.query.carUsers.findFirst({
    where: and(eq(carUsers.usrId, userId), eq(carUsers.entId, entId), isNull(carUsers.usrDeletedAt)),
  });
  if (!target) throw new CarError('CAR-E0404', 404, 'User not found');
  /* ADMIN always sees every region — narrowing one would be a silent no-op. */
  if (target.usrLocalRole === 'ADMIN') {
    throw new CarError('CAR-E0409', 409, 'ADMIN always has access to every region');
  }
  return target;
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADMIN — set a user's complete region set (REQ-20260813).
 *
 * `regions` is the desired end state, not a delta. An empty array clears every
 * grant, which resets the user to the default of seeing all regions.
 *
 * neon-http has no interactive transaction, so grants are inserted before
 * revokes: a mid-way failure leaves the user wider, never accidentally locked
 * out of a region they should keep. Re-running is safe.
 * ──────────────────────────────────────────────────────────────────────── */
export async function setRegionAccessAction(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = setRegionAccessSchema.parse(input);

    const target = await loadTarget(actor.entId, dto.userId);
    const before = await liveGrants(actor.entId, dto.userId);

    const desired = [...new Set(dto.regions)];
    const desiredCodes: readonly string[] = desired;
    const toAdd = desired.filter((r) => !before.includes(r));
    const toRemove = before.filter((r) => !desiredCodes.includes(r));

    if (toAdd.length > 0) {
      await db.insert(carUserRegionAccess).values(
        toAdd.map((region) => ({
          uraId: randomUUID(),
          entId: actor.entId,
          usrId: dto.userId,
          uraRegion: region,
          uraGrantedBy: actor.userId,
        })),
      );
    }

    if (toRemove.length > 0) {
      await db
        .update(carUserRegionAccess)
        .set({ uraDeletedAt: new Date() })
        .where(
          and(
            eq(carUserRegionAccess.entId, actor.entId),
            eq(carUserRegionAccess.usrId, dto.userId),
            inArray(carUserRegionAccess.uraRegion, toRemove),
            isNull(carUserRegionAccess.uraDeletedAt),
          ),
        );
    }

    if (toAdd.length === 0 && toRemove.length === 0) {
      return { ok: true as const };
    }

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'REGION.ACCESS_SET',
      entity: 'User',
      entityId: dto.userId,
      entityRef: target.usrName ?? target.usrEmail ?? dto.userId,
      before: { regions: before, unrestricted: before.length === 0 },
      after: { regions: desired, unrestricted: desired.length === 0 },
    });

    await notifyUser({
      entId: actor.entId,
      userId: dto.userId,
      event: 'REGION.ACCESS_SET',
      title: 'Region access updated',
      body:
        desired.length === 0
          ? 'You can now access every region'
          : `Your region access is now limited to ${desired.join(', ')}`,
      template: { ref: desired.join(',') || 'ALL', tripPath: '/settings/region-access' },
    });

    revalidateRegionAdmin();
    return { ok: true as const };
  });
}

/* ─────────────────────────────────────────────────────────────────────────
 * ADMIN — clear every grant so the user falls back to all regions.
 * ──────────────────────────────────────────────────────────────────────── */
export async function revokeAllRegionAccessAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = revokeAllRegionAccessSchema.parse(input);

    const target = await loadTarget(actor.entId, dto.userId);
    const before = await liveGrants(actor.entId, dto.userId);
    if (before.length === 0) return { ok: true as const };

    await db
      .update(carUserRegionAccess)
      .set({ uraDeletedAt: new Date() })
      .where(
        and(
          eq(carUserRegionAccess.entId, actor.entId),
          eq(carUserRegionAccess.usrId, dto.userId),
          isNull(carUserRegionAccess.uraDeletedAt),
        ),
      );

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'REGION.ACCESS_CLEARED',
      entity: 'User',
      entityId: dto.userId,
      entityRef: target.usrName ?? target.usrEmail ?? dto.userId,
      before: { regions: before },
      after: { regions: [], unrestricted: true },
    });

    await notifyUser({
      entId: actor.entId,
      userId: dto.userId,
      event: 'REGION.ACCESS_CLEARED',
      title: 'Region access updated',
      body: 'You can now access every region',
      template: { ref: 'ALL', tripPath: '/settings/region-access' },
    });

    revalidateRegionAdmin();
    return { ok: true as const };
  });
}
