import { NextResponse, type NextRequest } from 'next/server';
import { evaluateAllTenants } from '@/server/services/maintenance-alert.service';
import { getCronSecret } from '@/lib/env';
import { logAudit } from '@/server/services/audit-log.service';

/**
 * POST /api/v1/cron/maintenance-alert
 *
 * Runs the maintenance-alert evaluator across all tenants. Designed for daily
 * invocation via Render Cron Job (registered separately — D9 of REQ-20260519
 * defers actual cron deployment).
 *
 * Auth: bearer `CRON_SECRET` (env). Returns 401 when missing or mismatched.
 * Idempotency: the evaluator's 24h window prevents duplicate alerts even if
 * called multiple times per day.
 *
 * Manual trigger: scripts/trigger-maintenance-cron.mjs (added P7) or
 *   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $URL/api/v1/cron/maintenance-alert`
 */
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: 'CAR-E0101', message: 'Unauthorized' },
      timestamp: new Date().toISOString(),
    },
    { status: 401 },
  );
}

async function handle(req: NextRequest) {
  const expected = getCronSecret();
  if (!expected) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CAR-E0500', message: 'Cron secret not configured' },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
  const header = req.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (presented !== expected) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const result = await evaluateAllTenants();
  const elapsedMs = Date.now() - startedAt;

  /* System-level audit log (no specific tenant — multi-tenant scan). */
  await logAudit({
    entId: 'system',
    userId: null,
    action: 'MAINTENANCE.CRON_EVALUATED',
    entity: 'System',
    after: {
      ...result,
      elapsedMs,
    },
  });

  return NextResponse.json({
    success: true,
    data: { ...result, elapsedMs },
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

/* Render Cron Job may issue GET — accept both. */
export async function GET(req: NextRequest) {
  return handle(req);
}
