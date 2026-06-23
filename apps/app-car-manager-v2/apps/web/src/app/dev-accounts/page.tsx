import { notFound } from 'next/navigation';
import { DEV_PERSONAS, loginHrefFor, localRoleFor } from '@/lib/dev/test-personas';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<'ADMIN' | 'MANAGER' | 'DRIVER', string> = {
  ADMIN: 'Admin',
  MANAGER: 'Quản lý',
  DRIVER: 'Tài xế',
};

export default function DevAccountsPage() {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') notFound();

  return (
    <main className="min-h-dvh bg-bg flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-text">Chọn vai trò (dev)</h1>
          <p className="text-xs text-text-faint mt-0.5">
            Chỉ hiện khi <code className="rounded bg-surface-2 px-1">DEMO_AUTO_LOGIN=true</code>
          </p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {DEV_PERSONAS.map((p) => {
            const role = localRoleFor(p);
            return (
              <li key={p.key}>
                <a
                  href={loginHrefFor(p)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent/50 hover:bg-accent-soft/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text group-hover:text-accent truncate">
                      {p.name}
                    </div>
                    <div className="mt-0.5 text-[10.5px] font-medium text-text-muted">
                      {ROLE_LABEL[role]}
                    </div>
                  </div>
                  <span className="text-xs text-text-faint group-hover:text-accent shrink-0">→</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
