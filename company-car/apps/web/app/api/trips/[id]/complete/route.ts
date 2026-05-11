import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/api/auth-guard';
import { handleError, ok } from '@/lib/api/response';
import { completeTrip, toTripResponse } from '@/lib/services/trip.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['DRIVER']);
    const { id } = await ctxParam.params;
    const updated = await completeTrip(id, auth.userId);
    await recordAudit({ userId: auth.userId, action: 'COMPLETE', entityType: 'trip', entityId: id, req });
    return ok(toTripResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}
