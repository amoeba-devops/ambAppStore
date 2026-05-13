import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getArchivePeriod } from '@/lib/raw-archive-mock';
import { ArchiveDetailClient } from '@/components/raw-archive/ArchiveDetailClient';

interface Props {
  params: Promise<{ period: string }>;
}

export default async function ArchivePeriodPage({ params }: Props) {
  await getCurrentUser();
  const { period: periodKey } = await params;
  const period = getArchivePeriod(decodeURIComponent(periodKey));
  if (!period) notFound();
  return <ArchiveDetailClient period={period} />;
}
