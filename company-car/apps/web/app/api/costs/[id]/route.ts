import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { CostTypeEnum } from '@repo/api-types';
import { db } from '@/lib/db/client';
import { costs } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, notFound, ok } from '@/lib/api/response';
import { deleteCost, getCost, toCostResponse, updateCost } from '@/lib/services/cost.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    const { id } = await ctxParam.params;
    const row = await getCost(id);
    if (!row) return notFound('Cost not found');
    return ok({
      ...toCostResponse(row.cost),
      vehicle: row.vehicle,
      submitter: row.submitter,
      attachments: row.attachments.map((a) => ({
        id: a.id,
        costId: a.costId,
        fileUrl: a.fileUrl,
        fileKey: a.fileKey,
        fileType: a.fileType,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

const PatchSchema = z.object({
  type: CostTypeEnum.optional(),
  vehicleId: z.string().uuid().optional(),
  tripId: z.string().uuid().nullable().optional(),
  costDate: z.string().date().optional(),
  amount: z.coerce.number().positive().optional(),
  description: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  currency: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id } = await ctxParam.params;
    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const [current] = await db.select().from(costs).where(eq(costs.id, id)).limit(1);
    if (!current) return notFound('Cost not found');

    const updated = await updateCost(
      id,
      {
        type: parsed.data.type,
        vehicleId: parsed.data.vehicleId,
        tripId: parsed.data.tripId ?? undefined,
        costDate: parsed.data.costDate,
        amount: parsed.data.amount,
        description: parsed.data.description ?? undefined,
        metadata: parsed.data.metadata,
        currency: parsed.data.currency,
      },
      auth,
    );

    await recordAudit({
      userId: auth.userId,
      action: 'UPDATE',
      entityType: 'cost',
      entityId: id,
      oldValue: toCostResponse(current),
      newValue: toCostResponse(updated),
      req,
    });
    return ok(toCostResponse(updated));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const { id } = await ctxParam.params;
    const [current] = await db.select().from(costs).where(eq(costs.id, id)).limit(1);
    if (!current) return notFound('Cost not found');
    await deleteCost(id);
    await recordAudit({
      userId: auth.userId,
      action: 'DELETE',
      entityType: 'cost',
      entityId: id,
      oldValue: toCostResponse(current),
      req,
    });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
