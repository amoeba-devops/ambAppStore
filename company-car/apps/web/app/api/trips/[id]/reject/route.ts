import type { NextRequest } from 'next/server';
import { RejectTripSchema } from '@repo/api-types';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { rejectTrip, toTripResponse } from '@/lib/services/trip.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['DRIVER']);
    const body = await req.json().catch(() => null);
    const parsed = RejectTripSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const { id } = await ctxParam.params;
    const updated = await rejectTrip(id, auth.userId, parsed.data.reason);
    await recordAudit({
      userId: auth.userId,
      action: 'REJECT',
      entityType: 'trip',
      entityId: id,
      newValue: { reason: parsed.data.reason },
      req,
    });
    return ok(toTripResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}
