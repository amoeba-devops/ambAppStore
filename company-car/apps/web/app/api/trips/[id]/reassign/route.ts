import type { NextRequest } from 'next/server';
import { ReassignDriverSchema } from '@repo/api-types';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { reassignTrip, toTripResponse } from '@/lib/services/trip.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const body = await req.json().catch(() => null);
    const parsed = ReassignDriverSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const { id } = await ctxParam.params;
    const updated = await reassignTrip(id, parsed.data.driverId);
    await recordAudit({
      userId: auth.userId,
      action: 'REASSIGN',
      entityType: 'trip',
      entityId: id,
      newValue: { driverId: parsed.data.driverId },
      req,
    });
    return ok(toTripResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}
