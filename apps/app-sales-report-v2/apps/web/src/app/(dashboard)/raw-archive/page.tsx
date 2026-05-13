import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getAllArchivePeriods } from '@/lib/raw-archive-mock';
import { ArchiveListClient } from '@/components/raw-archive/ArchiveListClient';

export default async function RawArchivePage() {
  await getCurrentUser();
  const periods = getAllArchivePeriods();
  return <ArchiveListClient periods={periods} />;
}
