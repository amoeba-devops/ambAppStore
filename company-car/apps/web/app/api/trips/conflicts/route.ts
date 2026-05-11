import type { NextRequest } from 'next/server';
import { ConflictCheckSchema } from '@repo/api-types';
import { requireAuth } from '@/lib/api/auth-guard';
import { fromZod, handleError, ok } from '@/lib/api/response';
import { findConflicts } from '@/lib/services/trip.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const parsed = ConflictCheckSchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) return fromZod(parsed.error);

    const conflicts = await findConflicts(parsed.data);
    return ok({ conflicts, hasConflict: conflicts.length > 0 });
  } catch (err) {
    return handleError(err);
  }
}
