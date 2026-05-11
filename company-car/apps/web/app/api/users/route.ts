import type { NextRequest } from 'next/server';
import { CreateUserSchema, RoleEnum, UserStatusEnum } from '@repo/api-types';
import { z } from 'zod';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { createUser, listUsers, toUserResponse } from '@/lib/services/user.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

const ListQuery = z.object({
  role: RoleEnum.optional(),
  status: UserStatusEnum.optional(),
  q: z.string().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN']);
    const parsed = ListQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return fromZod(parsed.error);
    const rows = await listUsers(parsed.data);
    return ok(rows.map(toUserResponse));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const body = await req.json().catch(() => null);
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);
    const created = await createUser(parsed.data);
    await recordAudit({
      userId: auth.userId,
      action: 'CREATE',
      entityType: 'user',
      entityId: created.id,
      newValue: { email: created.email, role: created.role },
      req,
    });
    return ok(toUserResponse(created), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
