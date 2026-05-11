import type { NextRequest } from 'next/server';
import { CreateTripSchema, TripStatusEnum } from '@repo/api-types';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import {
  badRequest,
  fromZod,
  handleError,
  ok,
  paginated,
} from '@/lib/api/response';
import {
  createTrip,
  listTrips,
  toTripListItem,
  toTripResponse,
} from '@/lib/services/trip.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

const ListQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  passengerId: z.string().uuid().optional(),
  status: TripStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const parsed = ListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return fromZod(parsed.error);

    const { items, total } = await listTrips(parsed.data, ctx);
    return paginated(items.map(toTripListItem), {
      page: parsed.data.page,
      limit: parsed.data.limit,
      total,
    });
  } catch (err) {
    return handleError(err);
  }
}

const CreateBodySchema = CreateTripSchema.extend({
  overrideConflict: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['ADMIN', 'MANAGER']);
    const body = await req.json().catch(() => null);
    const parsed = CreateBodySchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const { overrideConflict, ...input } = parsed.data;
    const created = await createTrip({
      input,
      createdBy: ctx.userId,
      overrideConflict: Boolean(overrideConflict),
      isAdmin: ctx.role === 'ADMIN',
    });
    await recordAudit({
      userId: ctx.userId,
      action: 'CREATE',
      entityType: 'trip',
      entityId: created.id,
      newValue: toTripResponse(created),
      req,
    });
    return ok(toTripResponse(created), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
