import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  CostStatusEnum,
  CostTypeEnum,
  CreateCostBaseSchema,
} from '@repo/api-types';
import { requireAuth } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok, paginated } from '@/lib/api/response';
import { createCost, listCosts, toCostResponse } from '@/lib/services/cost.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

const ListQuerySchema = z.object({
  type: CostTypeEnum.optional(),
  vehicleId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  status: CostStatusEnum.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const parsed = ListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return fromZod(parsed.error);
    const { items, total } = await listCosts(parsed.data, ctx);
    return paginated(
      items.map((row) => ({
        ...toCostResponse(row.cost),
        licensePlate: row.licensePlate,
        submitterName: row.submitterName,
      })),
      { page: parsed.data.page, limit: parsed.data.limit, total },
    );
  } catch (err) {
    return handleError(err);
  }
}

const CreateBodySchema = CreateCostBaseSchema.extend({
  preApproval: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const body = await req.json().catch(() => null);
    const parsed = CreateBodySchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const created = await createCost({
      ...parsed.data,
      submittedBy: ctx.userId,
    });
    await recordAudit({
      userId: ctx.userId,
      action: 'CREATE',
      entityType: 'cost',
      entityId: created.id,
      newValue: toCostResponse(created),
      req,
    });
    return ok(toCostResponse(created), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
