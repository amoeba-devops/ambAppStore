import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listArchivePeriods } from '@/server/services/archive-files.service';
import { UploadReportsClient } from '@/components/upload/UploadReportsClient';

export default async function UploadPage() {
  const user = await getCurrentUser();
  requireRole(user.role, ['OPERATOR', 'ADMIN']);
  // Real periods with a DB snapshot — used to filter stale status overrides
  // in Step 1's WeekPicker/MonthPicker so deleted/never-ingested demo weeks
  // don't show residual "Active"/"Finalized" badges.
  const periods = await listArchivePeriods(user.entId);
  const realPeriodKeys = periods.map((p) => ({ label: p.periodKey, year: p.year }));
  return <UploadReportsClient realPeriodKeys={realPeriodKeys} />;
}
