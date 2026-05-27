'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import type { ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { runAction } from '../_helpers';

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

const updateMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['MASTER', 'MANAGER', 'MEMBER', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  department: z.string().max(30).optional(),
  jobTitle: z.string().max(100).optional(),
  /* Wave 3: email = login key. AMA-side normalize + validate RFC + check
   * uniqueness trong tenant. Sai = user không login được. */
  email: z.string().email('Email không hợp lệ').max(255).optional(),
  /* phone là contact (optional) — không phải login key sau Wave 3. */
  phone: z.string().regex(/^[+0-9\s\-]{9,15}$/, 'SĐT không đúng format').optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/**
 * Update existing entity member qua AMA endpoint.
 *
 * AMA `PATCH /entity-settings/members/:userId` (OwnEntityGuard → MASTER/ADMIN only).
 * v2 ADMIN local role có khả năng dùng được (AMA's eur_role = ADMIN/MASTER/OWNER).
 *
 * Returns updated member info từ AMA.
 */
export async function updateMemberAction(
  input: UpdateMemberInput,
): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN']);

    const dto = updateMemberSchema.parse(input);

    const cookieStore = await cookies();
    /* Option B fallback: standalone có amb_ama_access, embed chỉ có amb_session. */
    const amaAccess =
      cookieStore.get('amb_ama_access')?.value ??
      cookieStore.get(SESSION_COOKIE)?.value;
    if (!amaAccess) {
      throw new CarError(
        'CAR-E0101',
        401,
        'Phiên AMA đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    const body: Record<string, string> = {};
    if (dto.role) body.role = dto.role;
    if (dto.status) body.status = dto.status;
    if (dto.department !== undefined) body.department = dto.department;
    if (dto.jobTitle !== undefined) body.job_title = dto.jobTitle;
    if (dto.email !== undefined) body.email = dto.email;
    if (dto.phone !== undefined) body.phone = dto.phone;

    const url = `${AMA_API}/entity-settings/members/${dto.userId}?entity_id=${actor.entId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${amaAccess}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      throw new CarError('CAR-E0101', 401, 'Phiên AMA đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (res.status === 403) {
      const errBody = await res.json().catch(() => ({}));
      throw new CarError(
        'CAR-E0102',
        403,
        errBody?.message ?? 'Không có quyền chỉnh sửa người này.',
      );
    }
    if (res.status === 400) {
      const errBody = await res.json().catch(() => ({}));
      // Pass through AMA error message để user biết chính xác lý do
      const amaMsg = errBody?.message ?? errBody?.error?.message;
      // Convert common AMA messages sang VN
      let msg = 'Dữ liệu không hợp lệ';
      if (amaMsg) {
        if (/Member not found/i.test(amaMsg)) {
          msg = 'Thành viên này thuộc công ty khác (cross-entity) — không chỉnh sửa được từ đây.';
        } else if (/role/i.test(amaMsg)) {
          msg = `Vai trò không hợp lệ: ${amaMsg}`;
        } else {
          msg = amaMsg;
        }
      }
      throw new CarError('CAR-E2001', 400, msg);
    }
    if (res.status === 404) {
      throw new CarError('CAR-E2002', 404, 'Thành viên không tồn tại');
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new CarError(
        'CAR-E0500',
        res.status,
        errBody?.message ?? `AMA error ${res.status}`,
      );
    }

    revalidatePath('/users');
    revalidatePath(`/users/${dto.userId}/edit`);
    return { ok: true as const };
  });
}
