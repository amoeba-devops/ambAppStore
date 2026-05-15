import { getCurrentUser } from '@/lib/auth/get-current-user';
import { MonthlyReportClient } from '@/components/monthly/MonthlyReportClient';

export default async function MonthlyReportPage() {
  await getCurrentUser();
  return <MonthlyReportClient />;
}
