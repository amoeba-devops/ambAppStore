import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { VehicleStatusEnum } from '@repo/api-types';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { getVehicle, setVehicleStatus, toVehicleResponse } from '@/lib/services/vehicle.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

const Schema = z.object({ status: VehicleStatusEnum });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const updated = await setVehicleStatus(id, parsed.data.status);
    const after = await getVehicle(updated.id);
    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'vehicle',
      entityId: id,
      newValue: { status: parsed.data.status },
      req,
    });
    return ok(after ? toVehicleResponse(after) : null);
  } catch (err) {
    return handleError(err);
  }
}
