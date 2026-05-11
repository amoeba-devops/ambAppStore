import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/api/auth-guard';
import { handleError, ok } from '@/lib/api/response';
import { listSettings } from '@/lib/services/settings.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN']);
    const rows = await listSettings();
    return ok(rows);
  } catch (err) {
    return handleError(err);
  }
}
