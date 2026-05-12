'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard error]', error);
  }, [error]);

  const isForbidden = error.message.startsWith('Forbidden') || error.message.includes('SAL-E0102');
  const isUnauth = error.message.startsWith('Unauthenticated') || error.message.includes('SAL-E0101');

  if (isForbidden) {
    return (
      <div className="mx-auto max-w-md pt-12">
        <div className="rounded-lg border border-warning-500 bg-warning-50 p-6">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-warning-500">
            SAL-E0102 · Forbidden
          </div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Access denied</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Trang này yêu cầu role cao hơn. Liên hệ Admin nếu cần access.
          </p>
        </div>
      </div>
    );
  }

  if (isUnauth) {
    return (
      <div className="mx-auto max-w-md pt-12">
        <div className="rounded-lg border border-error-500 bg-error-50 p-6">
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-error-500">
            SAL-E0101 · Unauthenticated
          </div>
          <h2 className="mt-2 text-lg font-semibold text-neutral-900">Session expired</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Phiên đăng nhập đã hết hạn. Mở lại từ AMA Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="rounded-lg border border-error-500 bg-error-50 p-6">
        <div className="font-mono text-xs font-semibold uppercase tracking-wider text-error-500">
          Error
        </div>
        <h2 className="mt-2 text-lg font-semibold text-neutral-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-neutral-700">{error.message}</p>
        <button
          onClick={() => reset()}
          className="mt-4 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-50 hover:bg-neutral-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
