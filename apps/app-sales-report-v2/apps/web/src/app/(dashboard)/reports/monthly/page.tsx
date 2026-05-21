import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listArchivePeriods } from '@/server/services/archive-files.service';
import { MonthlyReportClient } from '@/components/monthly/MonthlyReportClient';

export default async function MonthlyReportPage() {
  const user = await getCurrentUser();
  const periods = await listArchivePeriods(user.entId);
  const realMonthKeys = periods
    .filter((p) => p.granularity === 'MONTHLY')
    .map((p) => ({ monthIdx: p.monthIdx!, year: p.year }));
  return <MonthlyReportClient realMonthKeys={realMonthKeys} />;
}
