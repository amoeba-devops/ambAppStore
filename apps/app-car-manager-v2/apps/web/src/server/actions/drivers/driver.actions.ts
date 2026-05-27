'use server';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carDrivers, carUsers, type CarDriver } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { createDriverSchema, updateDriverSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { listEntityMembersFromAma } from '@/server/services/ama/list-entity-members';
import { runAction } from '../_helpers';

/** Resolve phone from linked AMA user (source of truth cho phone-login).
 *  Trả về `null` nếu không tìm thấy (user chưa có phone, AMA unreachable, ...).
 *  Driver record's `drv_phone` luôn đồng bộ với giá trị này — tránh bị drift
 *  khiến driver login bằng số khác nhau với số trên record. */
async function resolveUserPhone(entId: string, userId: string): Promise<string | null> {
  const members = await listEntityMembersFromAma(entId);
  if (!members) return null;
  return members.find((m) => m.userId === userId)?.phone ?? null;
}

export async function createDriverAction(input: unknown): Promise<ActionResult<CarDriver>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = createDriverSchema.parse(input);

    // Verify the user exists in this tenant.
    const user = await db.query.carUsers.findFirst({
      where: and(eq(carUsers.usrId, data.user_id), eq(carUsers.entId, actor.entId)),
    });
    if (!user) throw new CarError('CAR-E0404', 404, 'User not found in this tenant');

    /* Phone đồng bộ từ AMA user account — ignore client input. Đảm bảo
     * drv_phone luôn = số đăng nhập, tránh driver confused khi login. */
    const syncedPhone = await resolveUserPhone(actor.entId, data.user_id);

    const [created] = await db
      .insert(carDrivers)
      .values({
        drvId: randomUUID(),
        entId: actor.entId,
        drvUserId: data.user_id,
        drvLicenseNumber: data.license_number,
        drvLicenseClass: data.license_class,
        drvLicenseExpiry: data.license_expiry,
        drvPhone: syncedPhone,
        drvEmergencyContact: data.emergency_contact ?? null,
        drvNotes: data.notes ?? null,
      })
      .returning();
    if (!created) throw new CarError('CAR-E0500', 500, 'Insert returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.CREATE',
      entity: 'Driver',
      entityId: created.drvId,
      entityRef: user.usrName ?? data.license_number,
      after: { license: created.drvLicenseNumber, user_id: created.drvUserId },
    });

    revalidatePath('/drivers');
    return created;
  });
}

export async function updateDriverAction(id: string, input: unknown): Promise<ActionResult<CarDriver>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    const data = updateDriverSchema.parse(input);

    const existing = await db.query.carDrivers.findFirst({
      where: and(eq(carDrivers.drvId, id), eq(carDrivers.entId, actor.entId)),
    });
    if (!existing) throw new CarError('CAR-E0404', 404, 'Driver not found');

    const patch: Partial<typeof carDrivers.$inferInsert> = { drvUpdatedAt: new Date() };
    if (data.license_number !== undefined) patch.drvLicenseNumber = data.license_number;
    if (data.license_class  !== undefined) patch.drvLicenseClass = data.license_class;
    if (data.license_expiry !== undefined) patch.drvLicenseExpiry = data.license_expiry;
    if (data.emergency_contact !== undefined) patch.drvEmergencyContact = data.emergency_contact;
    if (data.notes          !== undefined) patch.drvNotes = data.notes;
    if (data.status         !== undefined) patch.drvStatus = data.status;

    /* Phone luôn re-sync từ AMA — đảm bảo nếu admin đổi SĐT ở /users/[id]/edit,
     * lần update driver tiếp theo tự pick up giá trị mới. Client-sent `data.phone`
     * bị ignore (sẽ remove khỏi form ở step 4). */
    const syncedPhone = await resolveUserPhone(actor.entId, existing.drvUserId);
    if (syncedPhone !== existing.drvPhone) {
      patch.drvPhone = syncedPhone;
    }

    const [updated] = await db
      .update(carDrivers)
      .set(patch)
      .where(and(eq(carDrivers.drvId, id), eq(carDrivers.entId, actor.entId)))
      .returning();
    if (!updated) throw new CarError('CAR-E0500', 500, 'Update returned no row');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.UPDATE',
      entity: 'Driver',
      entityId: updated.drvId,
      before: { status: existing.drvStatus },
      after: { status: updated.drvStatus },
    });

    revalidatePath('/drivers');
    revalidatePath(`/drivers/${id}`);
    return updated;
  });
}
