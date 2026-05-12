import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';

export default async function DownloadHistoryPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['MANAGER', 'ADMIN']);

  return (
    <PlaceholderPage
      title="Download History"
      description="Immutable log of report exports per FR-21. Columns: user | report type | file name | format (XLSX/CSV) | timestamp. Filter by date."
      fr="FR-21"
      taskId="F-5 (T-503)"
    />
  );
}
