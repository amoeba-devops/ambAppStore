import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { getTruckReport } from '@/server/queries/truck-report.queries';
import { getSignedGetUrl } from '@/lib/s3-client';

/** GET /truck/reports/{id}/download — redirect to a short-lived presigned S3 URL
 * for the report file. TRUCK-fleet staff only (route handlers bypass the layout
 * guard, so re-check). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  if (user.role === 'DRIVER' || !(await hasFleet(user, 'TRUCK'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const { id } = await params;
  const report = await getTruckReport(user.entId, id);
  if (!report) return new Response('Not found', { status: 404 });

  const url = await getSignedGetUrl(report.trrS3Key, 300);
  if (!url) return new Response('Storage unavailable', { status: 503 });
  return NextResponse.redirect(url);
}
