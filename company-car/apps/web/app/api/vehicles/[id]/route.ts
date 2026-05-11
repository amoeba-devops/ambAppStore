import type { NextRequest } from 'next/server';
import { UpdateVehicleSchema } from '@repo/api-types';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, notFound, ok } from '@/lib/api/response';
import {
  deleteVehicle,
  getVehicle,
  toVehicleResponse,
  updateVehicle,
} from '@/lib/services/vehicle.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await ctx.params;
    const v = await getVehicle(id);
    if (!v) return notFound('Vehicle not found');
    return ok(toVehicleResponse(v));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = UpdateVehicleSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const before = await getVehicle(id);
    if (!before) return notFound('Vehicle not found');
    const updated = await updateVehicle(id, parsed.data);
    const after = await getVehicle(updated.id);

    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'vehicle',
      entityId: id,
      oldValue: toVehicleResponse(before),
      newValue: after ? toVehicleResponse(after) : null,
      req,
    });
    return ok(after ? toVehicleResponse(after) : null);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const before = await getVehicle(id);
    if (!before) return notFound('Vehicle not found');
    await deleteVehicle(id);
    await recordAudit({
      userId: auth.userId,
      action: 'DELETE',
      entityType: 'vehicle',
      entityId: id,
      oldValue: toVehicleResponse(before),
      req,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
