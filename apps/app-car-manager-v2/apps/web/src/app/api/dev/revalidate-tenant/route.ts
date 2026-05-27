import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { tenantSyncedAtTag } from '@/server/queries/tenant-onboarding.queries';

/**
 * Dev-only endpoint để invalidate onboarding gate cache.
 * Gated bởi DEMO_AUTO_LOGIN=true — production return 404.
 *
 * Test setup gọi endpoint này sau khi reset tns_users_synced_at trong DB,
 * để (app)/layout.tsx next request re-query DB thay vì serve cached value.
 *
 * Usage: POST /api/dev/revalidate-tenant?ent_id=<uuid>
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') {
    return new NextResponse('Disabled', { status: 404 });
  }
  const entId = req.nextUrl.searchParams.get('ent_id');
  if (!entId) {
    return NextResponse.json({ error: 'missing ent_id' }, { status: 400 });
  }
  revalidateTag(tenantSyncedAtTag(entId));
  return NextResponse.json({ ok: true, tag: tenantSyncedAtTag(entId) });
}
