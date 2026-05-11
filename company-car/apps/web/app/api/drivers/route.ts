import type { NextRequest } from 'next/server';
import { CreateDriverSchema, DriverStatusEnum } from '@repo/api-types';
import { requireAuth, requireRole } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { createDriver, listDrivers, toDriverResponse } from '@/lib/services/driver.service';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const statusParam = req.nextUrl.searchParams.get('status');
    const status = statusParam ? DriverStatusEnum.parse(statusParam) : undefined;
    const rows = await listDrivers({ status });
    return ok(rows.map(toDriverResponse));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['ADMIN']);
    const body = await req.json().catch(() => null);
    const parsed = CreateDriverSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);
    const created = await createDriver(parsed.data);
    await recordAudit({
      userId: auth.userId,
      action: 'CREATE',
      entityType: 'driver',
      entityId: created.id,
      newValue: toDriverResponse(created),
      req,
    });
    return ok(toDriverResponse(created), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
