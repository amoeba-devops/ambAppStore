'use server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@car-v2/db/client';
import { carDrivers, carUsers, type CarDriver } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { createDriverSchema, updateDriverSchema } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { logAudit } from '@/server/services/audit-log.service';
import { listEntityMembersFromAma } from '@/server/services/ama/list-entity-members';
import { runAction } from '../_helpers';

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

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
    requireRole(actor.role, ['ADMIN']);
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
    requireRole(actor.role, ['ADMIN']);
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

/* ─── Inline create driver + AMA user trong 1 flow ─────────────────────── */

const createDriverWithUserSchema = z.object({
  /* User info — sẽ tạo AMA member với phone-login enabled. */
  name: z.string().trim().min(2).max(50),
  phone: z.string().regex(/^[+0-9\s\-]{9,15}$/, 'SĐT không hợp lệ'),
  department: z.string().max(30).optional(),
  /* Driver info — license. */
  license_number: z.string().trim().min(1).max(50),
  license_class: z.enum(['A2', 'B1', 'B2', 'C', 'D', 'E', 'F']),
  license_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  emergency_contact: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateDriverWithUserInput = z.infer<typeof createDriverWithUserSchema>;

/**
 * Tạo driver trong 1 form duy nhất — auto-create AMA user backing driver.
 *
 * Flow:
 *   1. Verify caller là ADMIN
 *   2. Call AMA `phone-add` → tạo amb_users + amb_hr_entity_user_roles (MEMBER role)
 *      - AMA tự normalize phone, validate format, check unique theo ent_id
 *   3. ensureCarUser sẽ chạy ở lần login đầu tiên của driver → tự tạo car_users row
 *      Nhưng để tạo driver record ngay, ta cần car_users row trước → insert manually
 *      với usr_id = AMA user_id (ensureCarUser pattern đã align via heal migration)
 *   4. Insert car_drivers với drv_user_id = AMA user_id
 *   5. Audit + revalidate
 *
 * Phone uniqueness: enforced bởi AMA `phoneAddMember` service (check usr_phone +
 * usr_company_id NULL deleted). Cross-entity duplicate phone OK theo design —
 * mỗi tenant có namespace phone riêng.
 *
 * RBAC: ADMIN only (tạo user mới = creates AMA member, MANAGER không có quyền
 * gọi AMA endpoint qua OwnEntityManagerGuard cho MEMBER role nhưng có thể —
 * tuy nhiên việc tạo driver license cần thêm permission, restrict ADMIN cho an toàn).
 */
export async function createDriverWithUserAction(
  input: CreateDriverWithUserInput,
): Promise<ActionResult<CarDriver>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);
    const dto = createDriverWithUserSchema.parse(input);

    const cookieStore = await cookies();
    const amaAccess = cookieStore.get('amb_ama_access')?.value;
    if (!amaAccess) {
      throw new CarError('CAR-E0101', 401, 'Phiên AMA hết hạn. Vui lòng đăng nhập lại.');
    }

    /* Step 1: Tạo AMA user qua phone-add. AMA enforce phone unique trong ent. */
    const amaRes = await fetch(
      `${AMA_API}/entity-settings/members/phone-add?entity_id=${actor.entId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${amaAccess}`,
        },
        body: JSON.stringify({
          name: dto.name,
          phone: dto.phone,
          role: 'MEMBER', // driver → MEMBER trong AMA
          department: dto.department ?? undefined,
        }),
      },
    );
    if (!amaRes.ok) {
      const errBody = await amaRes.json().catch(() => ({}));
      const msg = errBody?.message ?? errBody?.error?.message ?? 'AMA tạo user thất bại';
      if (amaRes.status === 400 && /đã được dùng|already/i.test(msg)) {
        throw new CarError('CAR-E2003', 400, `SĐT ${dto.phone} đã được dùng cho user khác trong công ty này.`);
      }
      throw new CarError('CAR-E0500', amaRes.status, msg);
    }
    const amaBody = await amaRes.json();
    const newUserId = amaBody?.data?.userId as string | undefined;
    const canonicalPhone = amaBody?.data?.phone as string | undefined;
    if (!newUserId) {
      throw new CarError('CAR-E0500', 500, 'AMA response missing userId');
    }

    /* Step 2: Tạo car_users row mirror (usrId = AMA userId, theo heal migration).
     * Bình thường ensureCarUser sẽ làm việc này ở lần login đầu, nhưng driver
     * record cần FK ngay → tạo trước. */
    await db
      .insert(carUsers)
      .values({
        usrId: newUserId,
        entId: actor.entId,
        usrAmaUserId: newUserId,
        usrName: dto.name,
        usrEmail: null, // phone-add tạo placeholder email, không sync về v2
        usrLocalRole: 'DRIVER',
        usrAmaRoleSnapshot: 'MEMBER',
      })
      .onConflictDoNothing(); // idempotent nếu retry

    /* Step 3: Insert car_drivers. drv_phone sẽ sync từ AMA canonical phone. */
    const [created] = await db
      .insert(carDrivers)
      .values({
        drvId: randomUUID(),
        entId: actor.entId,
        drvUserId: newUserId,
        drvLicenseNumber: dto.license_number,
        drvLicenseClass: dto.license_class,
        drvLicenseExpiry: dto.license_expiry,
        drvPhone: canonicalPhone ?? null,
        drvEmergencyContact: dto.emergency_contact ?? null,
        drvNotes: dto.notes ?? null,
      })
      .returning();
    if (!created) throw new CarError('CAR-E0500', 500, 'Insert driver fail');

    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'DRIVER.CREATE_WITH_USER',
      entity: 'Driver',
      entityId: created.drvId,
      entityRef: dto.name,
      after: {
        license: created.drvLicenseNumber,
        user_id: created.drvUserId,
        phone: canonicalPhone,
        ama_user_created: true,
      },
    });

    revalidatePath('/drivers');
    revalidatePath('/users');
    return created;
  });
}
