import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTitleHeader } from '@/components/layout/PageTitleHeader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentUser();

  const user = {
    userId: ctx.userId,
    role: ctx.role,
  };

  return (
    <div className="flex h-screen bg-neutral-100">
      <Sidebar role={ctx.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PageTitleHeader user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
