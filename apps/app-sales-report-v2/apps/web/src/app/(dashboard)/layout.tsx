import { getCurrentUser } from '@/lib/auth/get-current-user';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-neutral-200 bg-white p-4">
        <div className="font-mono text-sm font-semibold tracking-tight">FIRGI · Sales Ops</div>
        <nav className="mt-6 space-y-1 text-sm">
          <a href="/dashboard" className="block rounded px-2 py-1.5 hover:bg-neutral-100">
            Dashboard
          </a>
          <a href="/upload" className="block rounded px-2 py-1.5 hover:bg-neutral-100">
            Upload
          </a>
          <a href="/manual-input" className="block rounded px-2 py-1.5 hover:bg-neutral-100">
            Manual Input
          </a>
          <a href="/cost-master/prime-cost" className="block rounded px-2 py-1.5 hover:bg-neutral-100">
            Prime Cost
          </a>
          <a href="/reports/weekly" className="block rounded px-2 py-1.5 hover:bg-neutral-100">
            Weekly Report
          </a>
          <a href="/activity-log/action" className="block rounded px-2 py-1.5 hover:bg-neutral-100">
            Activity Log
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <header className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
          <h1 className="text-lg font-semibold">Sales Report</h1>
          <div className="text-xs text-neutral-500">
            {user.role} · {user.userId.slice(0, 8)}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
