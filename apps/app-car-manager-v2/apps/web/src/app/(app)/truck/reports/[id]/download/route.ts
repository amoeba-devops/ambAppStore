import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { getTruckReport } from '@/server/queries/truck-report.queries';
import { getSignedGetUrl } from '@/lib/s3-client';
import { resolveUiLocale } from '@/i18n/ui-locale';

/* Filename-safe region tokens (proper nouns — same across locales). */
const REGION_FILE: Record<string, string> = { HCM: 'HCM', DONG_NAI: 'DongNai', BAIKSAN: 'Baiksan' };

/**
 * Localized download filename following the client template's naming
 * (BaoCao_DoiXe_T5_2026_Report.xlsx — REQ-20260713): the per-type pattern lives
 * in i18n (`screens.truckReports.fileName_*`) so the prefix translates with the
 * language the user is in when they hit download (which, for the "Lập báo cáo"
 * wizard, is the language they exported in — AutoDownloadReport calls this same
 * route right after generating). Falls back to the raw type+month if a pattern
 * is missing.
 */
async function reportDownloadName(report: {
  trrType: string;
  trrMonth: string;
  trrRegion: string | null;
}): Promise<string> {
  const locale = await resolveUiLocale();
  const [y = '', mm = ''] = report.trrMonth.split('-');
  const region = report.trrRegion ? `_${REGION_FILE[report.trrRegion] ?? report.trrRegion}` : '';
  try {
    const t = await getTranslations({ locale, namespace: 'screens.truckReports' });
    /* Dynamic i18n key — cast like the other export routes. String params only
     * (a number {y} would pick up ICU digit grouping: "2,026"). */
    const stem = t(`fileName_${report.trrType}` as Parameters<typeof t>[0], {
      m: String(Number(mm)),
      mm,
      y,
      region,
    });
    return `${stem}.xlsx`;
  } catch {
    return `${report.trrType}-${report.trrMonth}${region}.xlsx`;
  }
}

/** GET /truck/reports/{id}/download — redirect to a short-lived presigned S3 URL
 * for the report file, served under a localized human-readable filename. TRUCK-
 * fleet staff only (route handlers bypass the layout guard, so re-check). */
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

  const url = await getSignedGetUrl(report.trrS3Key, 300, await reportDownloadName(report));
  if (!url) return new Response('Storage unavailable', { status: 503 });
  return NextResponse.redirect(url);
}
