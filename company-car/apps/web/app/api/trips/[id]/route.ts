import type { NextRequest } from 'next/server';
import { UpdateTripSchema } from '@repo/api-types';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import { db } from '@/lib/db/client';
import { drivers, trips } from '@/lib/db/schema';
import { fromZod, forbidden, handleError, notFound, ok } from '@/lib/api/response';
import { deleteTrip, getTrip, toTripResponse } from '@/lib/services/trip.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id } = await ctxParam.params;
    const row = await getTrip(id);
    if (!row) return notFound('Trip not found');

    // Authorization (BR-06, BR-07)
    if (auth.role === 'MANAGER' && row.trip.passengerId !== auth.userId && row.trip.createdBy !== auth.userId) {
      return forbidden('You can only view your own trips');
    }
    if (auth.role === 'DRIVER') {
      const [d] = await db.select().from(drivers).where(eq(drivers.userId, auth.userId)).limit(1);
      if (!d || d.id !== row.trip.driverId) return forbidden('You are not the assigned driver');
    }

    return ok({ ...toTripResponse(row.trip), passenger: row.passenger, driver: row.driver, vehicle: row.vehicle });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id } = await ctxParam.params;
    const [current] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!current) return notFound('Trip not found');

    // Only creator or admin
    if (auth.role !== 'ADMIN' && current.createdBy !== auth.userId) {
      return forbidden('Only the trip creator or an admin can edit');
    }
    if (current.status !== 'PENDING_DRIVER_CONFIRM') {
      return forbidden('Trip can only be edited while pending driver confirmation');
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateTripSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const [updated] = await db
      .update(trips)
      .set({ ...parsed.data, tripTime: parsed.data.tripTime ? `${parsed.data.tripTime}:00` : undefined, updatedAt: new Date() })
      .where(eq(trips.id, id))
      .returning();

    if (!updated) return notFound('Trip not found');

    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'trip',
      entityId: id,
      oldValue: toTripResponse(current),
      newValue: toTripResponse(updated),
      req,
    });

    return ok(toTripResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctxParam.params;
    const [current] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!current) return notFound('Trip not found');

    await deleteTrip(id);
    await recordAudit({
      userId: auth.userId,
      action: 'DELETE',
      entityType: 'trip',
      entityId: id,
      oldValue: toTripResponse(current),
      req,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
