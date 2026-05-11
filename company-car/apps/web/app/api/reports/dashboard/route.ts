import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { getDashboardSummary } from '@/lib/services/report.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return fromZod(parsed.error);
    const summary = await getDashboardSummary(parsed.data);
    return ok(summary);
  } catch (err) {
    return handleError(err);
  }
}
