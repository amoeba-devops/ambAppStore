import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listArchivePeriods } from '@/server/services/archive-files.service';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTitleHeader } from '@/components/layout/PageTitleHeader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUser();

  const user = {
    userId: ctx.userId,
    role: ctx.role,
  };

  // Server-side: count real archived periods so the Raw Archive badge can show
  // "N pending approval" reflecting actual DB rows, not mock seeds. Periods
  // explicitly Finalized via localStorage override don't count.
  const realPeriods = await listArchivePeriods(ctx.entId);
  const realPeriodKeys = realPeriods.map((p) => p.periodKey);

  return (
    <div className="flex h-screen bg-neutral-100">
      <Sidebar role={ctx.role} realPeriodKeys={realPeriodKeys} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PageTitleHeader user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
