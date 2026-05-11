import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, notFound, ok } from '@/lib/api/response';
import { getSetting, updateSetting } from '@/lib/services/settings.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

const PatchSchema = z.object({ value: z.unknown() });

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    await requireRole(req, ['ADMIN']);
    const { key } = await ctx.params;
    const s = await getSetting(key);
    if (!s) return notFound('Setting not found');
    return ok(s);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { key } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const before = await getSetting(key);
    const updated = await updateSetting(key, parsed.data.value, auth.userId);

    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'system_setting',
      entityId: null,
      oldValue: before ? { key, value: before.value } : null,
      newValue: { key, value: updated.value },
      req,
    });

    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}
