import type { NextRequest } from 'next/server';
import { RejectCostSchema } from '@repo/api-types';
import { requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { rejectCost, toCostResponse } from '@/lib/services/cost.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const body = await req.json().catch(() => null);
    const parsed = RejectCostSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);
    const { id } = await ctxParam.params;
    const updated = await rejectCost(id, auth.userId, parsed.data.reason);
    await recordAudit({
      userId: auth.userId,
      action: 'REJECT',
      entityType: 'cost',
      entityId: id,
      newValue: { reason: parsed.data.reason },
      req,
    });
    return ok(toCostResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}
