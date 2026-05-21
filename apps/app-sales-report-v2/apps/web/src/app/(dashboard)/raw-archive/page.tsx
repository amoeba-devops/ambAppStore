import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import type { ArchivePeriod } from '@/lib/raw-archive-mock';
import { listArchivePeriods } from '@/server/services/archive-files.service';
import { ArchiveListClient } from '@/components/raw-archive/ArchiveListClient';

export default async function RawArchivePage() {
  const user = await getCurrentUser();
  // Only show real DB-backed periods (ingested via the upload wizard). Mock
  // demo seeds (W13–W18) are no longer surfaced.
  const realSummaries = await listArchivePeriods(user.entId);
  const t = await getTranslations('rawArchive.downstreamLink');
  const periods: ArchivePeriod[] = realSummaries.map((s) => summaryToArchivePeriod(s, t));
  return <ArchiveListClient periods={periods} />;
}

function summaryToArchivePeriod(
  s: Awaited<ReturnType<typeof listArchivePeriods>>[number],
  t: (key: 'weekly' | 'monthly', values: { label: string }) => string,
): ArchivePeriod {
  return {
    periodKey: s.periodKey,
    label: s.label,
    rangeLabel: s.rangeLabel,
    granularity: s.granularity === 'WEEKLY' ? 'week' : 'month',
    weekNum: s.weekNum,
    monthIdx: s.monthIdx,
    year: s.year,
    status: 'Draft',
    ingestedAt: s.lastUploadedAt.toISOString(),
    ingestedBy: s.files[0]?.uploadedBy ?? '—',
    fileCount: s.fileCount,
    shopeeCount: s.files.filter((f) => f.channel === 'SHOPEE').length,
    tiktokCount: s.files.filter((f) => f.channel === 'TIKTOK').length,
    totalRows: s.totalRows,
    reuploadCount: Math.max(0, ...s.files.map((f) => f.revision - 1)),
    files: s.files.map((f) => ({
      id: f.arfId,
      platform: f.channel === 'SHOPEE' ? 'Shopee' : 'TikTok Shop',
      source: archiveSourceLabel(f.fileType),
      filename: f.filename,
      rows: f.rowCount ?? 0,
      bytes: f.sizeBytes,
      checksum: f.sha256 ?? '',
      uploadedAt: f.uploadedAt.toISOString(),
      uploadedBy: f.uploadedBy,
      storagePath: f.s3Key ?? `(no S3 — metadata only)`,
    })),
    manualInputs: s.manualInputs ?? {},
    formulaVersion: 'v1',
    formulaSnapshotAt: s.lastUploadedAt.toISOString(),
    activityLog: [],
    downstreamReports:
      s.granularity === 'WEEKLY'
        ? [t('weekly', { label: s.label })]
        : [t('monthly', { label: s.label })],
  };
}

function archiveSourceLabel(type: string): string {
  switch (type) {
    case 'SALES':
      return 'Sales';
    case 'ADS':
      return 'Ads';
    case 'BRAND_ADS':
      return 'Brand Ads';
    case 'OFF_PLATFORM_ADS':
      return 'Off-Platform Ads';
    case 'TRAFFIC':
      return 'Traffic';
    case 'AFFILIATE':
      return 'Affiliate';
    default:
      return type;
  }
}
