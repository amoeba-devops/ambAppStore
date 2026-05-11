import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { LanguageEnum, RoleEnum, UpdateUserSchema, UserStatusEnum } from '@repo/api-types';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, notFound, ok } from '@/lib/api/response';
import {
  deleteUser,
  getUser,
  setUserPassword,
  toUserResponse,
  updateUser,
} from '@/lib/services/user.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

const PatchSchema = UpdateUserSchema.extend({
  status: UserStatusEnum.optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const u = await getUser(id);
    if (!u) return notFound('User not found');
    return ok(toUserResponse(u));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const before = await getUser(id);
    if (!before) return notFound('User not found');

    const { newPassword, ...rest } = parsed.data;
    const updated = await updateUser(id, rest);
    if (newPassword) await setUserPassword(id, newPassword);

    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: id,
      oldValue: { email: before.email, role: before.role, status: before.status },
      newValue: { email: updated.email, role: updated.role, status: updated.status, passwordChanged: Boolean(newPassword) },
      req,
    });
    return ok(toUserResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    if (id === auth.userId) {
      return notFound('Cannot delete yourself');
    }
    const before = await getUser(id);
    if (!before) return notFound('User not found');
    await deleteUser(id);
    await recordAudit({
      userId: auth.userId,
      action: 'DELETE',
      entityType: 'user',
      entityId: id,
      oldValue: { email: before.email, role: before.role },
      req,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
