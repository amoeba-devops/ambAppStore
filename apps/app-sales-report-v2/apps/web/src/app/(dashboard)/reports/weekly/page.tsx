import { getCurrentUser } from '@/lib/auth/get-current-user';
import { WeeklyReportClient } from '@/components/weekly/WeeklyReportClient';

export default async function WeeklyReportPage() {
  await getCurrentUser();
  return <WeeklyReportClient />;
}
