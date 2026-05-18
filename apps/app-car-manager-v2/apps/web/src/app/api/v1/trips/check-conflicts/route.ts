import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { findTripConflicts } from '@/server/services/trip-conflict.service';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  vehicle_id: z.string().uuid().nullable().optional(),
  driver_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().min(5).max(1440).nullable().optional(),
  exclude_trip_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await getCurrentUser();
    /* Chỉ Admin / Manager mới cần check conflict — Driver không assign. */
    requireRole(actor.role, ['ADMIN', 'MANAGER']);

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const data = parsed.data;

    const scheduledAt = new Date(data.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new CarError('CAR-E0001', 400, 'Invalid scheduled_at');
    }

    const conflicts = await findTripConflicts({
      entId: actor.entId,
      vehicleId: data.vehicle_id ?? null,
      driverId: data.driver_id ?? null,
      scheduledAt,
      durationMinutes: data.duration_minutes ?? null,
      excludeTripId: data.exclude_trip_id,
    });

    return NextResponse.json({
      success: true,
      data: conflicts,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err =
      e instanceof CarError ? e : new CarError('CAR-E0500', 500, e instanceof Error ? e.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: { code: err.code, message: err.message },
        timestamp: new Date().toISOString(),
      },
      { status: err.httpStatus },
    );
  }
}
