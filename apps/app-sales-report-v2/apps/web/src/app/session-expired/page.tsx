import Link from 'next/link';

export default function SessionExpiredPage() {
  const demoEnabled = process.env.DEMO_AUTO_LOGIN === 'true';

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          FIRGI · Sales Ops
        </div>
        <h1 className="mt-3 text-xl font-semibold text-neutral-900">Session expired</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Please reopen this app from AMA Management to continue.
        </p>

        {demoEnabled && (
          <div className="mt-8 border-t border-dashed border-neutral-300 pt-6">
            <div className="flex items-center gap-2">
              <span className="rounded bg-warning-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning-500">
                Demo Mode
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Quick-login as a demo user (no real AMA needed):
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <DemoButton role="OWNER" label="Login as Admin (Owner)" />
              <DemoButton role="MANAGER" label="Login as Manager" />
              <DemoButton role="MEMBER" label="Login as Operator (Member)" />
            </div>
            <p className="mt-4 font-mono text-[10px] text-neutral-500">
              ⚠️ Demo mode only — do not enable on real production.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DemoButton({ role, label }: { role: string; label: string }) {
  return (
    <Link
      href={`/dev-login?role=${role}`}
      className="flex items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700"
    >
      <span>{label}</span>
      <span className="font-mono text-[10px] text-neutral-500">→</span>
    </Link>
  );
}
