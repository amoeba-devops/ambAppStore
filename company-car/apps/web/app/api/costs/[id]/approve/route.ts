import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/api/auth-guard';
import { handleError, ok } from '@/lib/api/response';
import { approveCost, toCostResponse } from '@/lib/services/cost.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctxParam.params;
    const updated = await approveCost(id, auth.userId);
    await recordAudit({ userId: auth.userId, action: 'APPROVE', entityType: 'cost', entityId: id, req });
    return ok(toCostResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}
