'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import type { ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { runAction } from '../_helpers';

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';

const addMemberSchema = z.object({
  name: z.string().min(2).max(50),
  phone: z.string().regex(/^\d{9,11}$/, 'Phone must be 9-11 digits'),
  role: z.enum(['MASTER', 'MANAGER', 'MEMBER', 'VIEWER']),
  department: z.string().max(30).optional(),
});

export interface AddMemberResult {
  userId: string;
  name: string;
  phone: string;
  role: string;
  entCode: string;
  entName: string;
  smsTemplate: string;
}

/**
 * D-017 — Admin tạo member bằng phone (v2 → AMA proxy).
 *
 * Permissions:
 *   - Local role ADMIN (= AMA OWNER/MASTER) tạo MANAGER/MEMBER/VIEWER
 *   - Local role MANAGER (= AMA MANAGER) chỉ tạo MEMBER/VIEWER (driver)
 *   - DRIVER không tạo được ai
 *
 * Forward: AMA access token (cookie `amb_ama_access`) → AMA `/entity-settings/members/phone-add`
 */
export async function addMemberAction(
  input: z.infer<typeof addMemberSchema>,
): Promise<ActionResult<AddMemberResult>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    const dto = addMemberSchema.parse(input);

    // MANAGER chỉ tạo MEMBER/VIEWER. ADMIN có thể tạo MASTER/MANAGER/MEMBER/VIEWER.
    if (actor.role === 'MANAGER' && !['MEMBER', 'VIEWER'].includes(dto.role)) {
      throw new CarError(
        'CAR-E0102',
        403,
        'Manager chỉ có thể tạo Driver (MEMBER) hoặc Viewer',
      );
    }

    const cookieStore = await cookies();
    const amaAccess = cookieStore.get('amb_ama_access')?.value;
    if (!amaAccess) {
      throw new CarError(
        'CAR-E0101',
        401,
        'Phiên AMA đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    const url = `${AMA_API}/entity-settings/members/phone-add?entity_id=${actor.entId}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${amaAccess}`,
      },
      body: JSON.stringify(dto),
    });

    if (res.status === 401 || res.status === 403) {
      throw new CarError('CAR-E0101', res.status, 'Phiên AMA không hợp lệ.');
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      throw new CarError(
        'CAR-E2001',
        400,
        body?.message ?? 'Dữ liệu không hợp lệ',
      );
    }
    if (!res.ok) {
      throw new CarError('CAR-E0500', 500, `AMA error ${res.status}`);
    }

    const body = await res.json();
    const data = body?.data as AddMemberResult | undefined;
    if (!data) {
      throw new CarError('CAR-E0500', 500, 'AMA response invalid');
    }
    return data;
  });
}
