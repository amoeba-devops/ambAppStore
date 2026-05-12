import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export default async function WeeklyReportPage() {
  await getCurrentUser();

  return (
    <PlaceholderPage
      title="Weekly Report"
      description="Period filter (chỉ tuần có data per FR-07 AC-02) + Overview Performance card (VND + KRW columns) + Discount Costs breakdown (Seller Voucher / Seller Discount / Free Gift / Total Platform Discount Rfr) + Promotional Costs breakdown + Product Breakdown Table + Export Excel (W{WW}_{YYYY}.xlsx). WoW indicators ▲ green / ▼ red / `----` first / `N/A` zero."
      fr="FR-07~10"
      taskId="F-4 (T-401~410)"
    />
  );
}
