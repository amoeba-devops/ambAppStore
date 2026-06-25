import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CarError } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { autocompletePlaces } from '@/server/services/places.service';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  query: z.string().min(1).max(200),
  sessionToken: z.string().min(1).max(128).optional(),
  languageCode: z.enum(['vi', 'en', 'ko']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    /* Require an authenticated user — middleware already enforced this
     * (cookie + JWT verified), so getCurrentUser() either succeeds or throws.
     * This guards against unauthenticated abuse + lets us scope rate-limits per user later. */
    await getCurrentUser();

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new CarError('CAR-E0001', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const predictions = await autocompletePlaces(parsed.data);
    return NextResponse.json({
      success: true,
      data: predictions,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = e instanceof CarError ? e : new CarError('CAR-E0500', 500, e instanceof Error ? e.message : 'Unknown error');
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
