import { getCurrentUser } from '@/lib/auth/get-current-user';
import { TrendsClient } from '@/components/trends/TrendsClient';

export default async function TrendingReportPage() {
  await getCurrentUser();
  return <TrendsClient />;
}
