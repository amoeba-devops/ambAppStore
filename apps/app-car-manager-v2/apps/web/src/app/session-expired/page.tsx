export default function SessionExpiredPage() {
  const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://ama.amoeba.site';
  const demoEnabled = process.env.DEMO_AUTO_LOGIN === 'true';

  return (
    <main className="flex min-h-screen items-center justify-center px-6 font-sans">
      <div className="max-w-md w-full rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Session expired</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Please return to ambManagement and re-open the app.
        </p>
        <a
          href={amaOrigin}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Open ambManagement
        </a>

        {demoEnabled && (
          <div className="mt-8 pt-6 border-t border-neutral-100">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.08em] mb-3">
              Dev login (local only)
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="/dev-login?role=OWNER"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-150 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-25"
              >
                Sign in as <span className="font-bold text-brand-700 ml-1">ADMIN</span>
              </a>
              <a
                href="/dev-login?role=MANAGER"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-150 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-25"
              >
                Sign in as <span className="font-bold text-brand-700 ml-1">MANAGER</span>
              </a>
              <a
                href="/dev-login?role=MEMBER"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-150 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-25"
              >
                Sign in as <span className="font-bold text-brand-700 ml-1">DRIVER</span>
              </a>
            </div>
            <p className="mt-3 text-[11px] text-neutral-400">
              Enabled because <code className="font-mono">DEMO_AUTO_LOGIN=true</code>. Turn off in production.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
