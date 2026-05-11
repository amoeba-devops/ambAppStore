import type { NextRequest } from 'next/server';
import { CancelTripSchema } from '@repo/api-types';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { trips } from '@/lib/db/schema';
import { requireRole } from '@/lib/api/auth-guard';
import { forbidden, fromZod, handleError, notFound, ok } from '@/lib/api/response';
import { cancelTrip, toTripResponse } from '@/lib/services/trip.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['MANAGER', 'ADMIN']);
    const body = await req.json().catch(() => null);
    const parsed = CancelTripSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const { id } = await ctxParam.params;
    const [current] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!current) return notFound('Trip not found');

    // Manager can only cancel their own trips
    if (auth.role === 'MANAGER' && current.createdBy !== auth.userId && current.passengerId !== auth.userId) {
      return forbidden('You can only cancel your own trips');
    }

    const updated = await cancelTrip(id, parsed.data.reason);
    await recordAudit({
      userId: auth.userId,
      action: 'CANCEL',
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
