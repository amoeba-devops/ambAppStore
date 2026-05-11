import type { NextRequest } from 'next/server';
import { UpdateDriverSchema } from '@repo/api-types';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, notFound, ok } from '@/lib/api/response';
import {
  deleteDriver,
  getDriver,
  toDriverResponse,
  updateDriver,
} from '@/lib/services/driver.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await ctx.params;
    const d = await getDriver(id);
    if (!d) return notFound('Driver not found');
    return ok(toDriverResponse(d));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = UpdateDriverSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);
    const before = await getDriver(id);
    if (!before) return notFound('Driver not found');
    const updated = await updateDriver(id, parsed.data);
    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'driver',
      entityId: id,
      oldValue: toDriverResponse(before),
      newValue: toDriverResponse(updated),
      req,
    });
    return ok(toDriverResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const before = await getDriver(id);
    if (!before) return notFound('Driver not found');
    await deleteDriver(id);
    await recordAudit({
      userId: auth.userId,
      action: 'DELETE',
      entityType: 'driver',
      entityId: id,
      oldValue: toDriverResponse(before),
      req,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
