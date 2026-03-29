export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">📦</div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Stock Management</h1>
          <p className="mt-1 text-sm text-gray-500">Amoeba Partner App</p>
        </div>
        <div className="rounded-xl border border-[#e2e5eb] bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
