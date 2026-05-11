import type { NextRequest } from 'next/server';
import { CreateVehicleSchema, VehicleStatusEnum } from '@repo/api-types';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import {
  createVehicle,
  getVehicle,
  listVehicles,
  toVehicleResponse,
} from '@/lib/services/vehicle.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const statusParam = req.nextUrl.searchParams.get('status');
    const status = statusParam ? VehicleStatusEnum.parse(statusParam) : undefined;
    const rows = await listVehicles({ status });
    return ok(rows.map(toVehicleResponse));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const body = await req.json().catch(() => null);
    const parsed = CreateVehicleSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const created = await createVehicle(parsed.data);
    const detail = await getVehicle(created.id);
    await recordAudit({
      userId: auth.userId,
      action: 'CREATE',
      entityType: 'vehicle',
      entityId: created.id,
      newValue: detail ? toVehicleResponse(detail) : { id: created.id },
      req,
    });
    return ok(detail ? toVehicleResponse(detail) : null, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
