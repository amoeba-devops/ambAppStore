import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-guard';
import { handleError, ok } from '@/lib/api/response';
import { submitCost, toCostResponse } from '@/lib/services/cost.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id } = await ctxParam.params;
    const updated = await submitCost(id, auth);
    await recordAudit({ userId: auth.userId, action: 'SUBMIT', entityType: 'cost', entityId: id, req });
    return ok(toCostResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}
