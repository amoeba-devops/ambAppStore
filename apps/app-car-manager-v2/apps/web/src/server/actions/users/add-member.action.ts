'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import type { ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { runAction } from '../_helpers';

const AMA_API = process.env.AMA_API_BASE_URL ?? 'http://localhost:3009/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'amb_session';

const addMemberSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email('Email không hợp lệ').max(255),
  role: z.enum(['MASTER', 'MANAGER', 'MEMBER', 'VIEWER']),
  department: z.string().max(30).optional(),
});

export interface AddMemberResult {
  userId: string;
  name: string;
  email: string;
  role: string;
  entCode: string;
  entName: string;
  emailTemplate: string;
}

/**
 * Admin tạo member bằng email (REQ-20260526 Wave 3).
 *
 * Permissions:
 *   - Local role ADMIN tạo MASTER/MANAGER/MEMBER/VIEWER
 *   - Local role MANAGER chỉ tạo MEMBER/VIEWER (driver/viewer)
 *   - DRIVER không tạo được ai
 *
 * Forward token (Option B fallback): amb_ama_access (standalone) || amb_session
 * (embed). AMA cần accept cả 2 — xem docs/integration/AMA-DEPENDENCIES.md §2.3.
 *
 * AMA endpoint: POST /entity-settings/members/email-add (chưa exist —
 * Wave 3 blocker). Khi AMA chưa support, action trả CAR-E0501 "not_implemented".
 */
export async function addMemberAction(
  input: z.infer<typeof addMemberSchema>,
): Promise<ActionResult<AddMemberResult>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    const dto = addMemberSchema.parse(input);

    if (actor.role === 'MANAGER' && !['MEMBER', 'VIEWER'].includes(dto.role)) {
      throw new CarError(
        'CAR-E0102',
        403,
        'Manager chỉ có thể tạo Driver (MEMBER) hoặc Viewer',
      );
    }

    const cookieStore = await cookies();
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

    const url = `${AMA_API}/entity-settings/members/email-add?entity_id=${actor.entId}`;
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
    if (res.status === 404) {
      /* Endpoint chưa exist — Wave 3 pending AMA team */
      throw new CarError(
        'CAR-E0501',
        501,
        'Tính năng tạo user bằng email đang được AMA team triển khai. Vui lòng tạo user qua AMA portal tạm thời.',
      );
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.message ?? 'Dữ liệu không hợp lệ';
      if (/email.*đã.*dùng|already|duplicate/i.test(msg)) {
        throw new CarError('CAR-E2003', 400, `Email ${dto.email} đã được dùng trong công ty này.`);
      }
      throw new CarError('CAR-E2001', 400, msg);
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
