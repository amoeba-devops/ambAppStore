import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getArchivePeriod, type ArchivePeriod } from '@/lib/raw-archive-mock';
import { listArchivePeriods } from '@/server/services/archive-files.service';
import { ArchiveDetailClient } from '@/components/raw-archive/ArchiveDetailClient';

interface Props {
  params: Promise<{ period: string }>;
}

export default async function ArchivePeriodPage({ params }: Props) {
  const user = await getCurrentUser();
  const { period: periodKey } = await params;
  const key = decodeURIComponent(periodKey);

  // Try real DB first; fall back to mock seeds for demo periods.
  const realSummaries = await listArchivePeriods(user.entId);
  const realMatch = realSummaries.find((s) => s.periodKey === key);
  const period: ArchivePeriod | undefined = realMatch
    ? summaryToArchivePeriod(realMatch)
    : getArchivePeriod(key);

  if (!period) notFound();
  return <ArchiveDetailClient period={period} />;
}

function summaryToArchivePeriod(
  s: Awaited<ReturnType<typeof listArchivePeriods>>[number],
): ArchivePeriod {
  return {
    periodKey: s.periodKey,
    label: s.label,
    rangeLabel: s.rangeLabel,
    granularity: s.granularity === 'WEEKLY' ? 'week' : 'month',
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
      storagePath: f.s3Key ?? '(no S3 — metadata only)',
    })),
    manualInputs: s.manualInputs ?? {},
    formulaVersion: 'v1',
    formulaSnapshotAt: s.lastUploadedAt.toISOString(),
    activityLog: [],
    downstreamReports:
      s.granularity === 'WEEKLY' ? [`Weekly Report ${s.label}`] : [`Monthly Report ${s.label}`],
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
