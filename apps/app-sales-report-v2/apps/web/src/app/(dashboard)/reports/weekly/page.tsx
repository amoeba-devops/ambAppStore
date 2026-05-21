import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listArchivePeriods } from '@/server/services/archive-files.service';
import { WeeklyReportClient } from '@/components/weekly/WeeklyReportClient';

export default async function WeeklyReportPage() {
  const user = await getCurrentUser();
  // Real weeks that have a snapshot — used to limit the WeekPicker so mock-only
  // weeks don't show. Period key is "W{num}", e.g. "W19".
  const periods = await listArchivePeriods(user.entId);
  const realWeekKeys = periods
    .filter((p) => p.granularity === 'WEEKLY')
    .map((p) => ({ weekNum: p.weekNum!, year: p.year }));
  return <WeeklyReportClient realWeekKeys={realWeekKeys} />;
}
