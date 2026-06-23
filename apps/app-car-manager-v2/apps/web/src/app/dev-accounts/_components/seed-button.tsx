'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { cn, toast } from '@car-v2/ui';
import { seedDevAccountsAction } from '@/server/actions/dev/seed-dev-accounts.action';

/** Triggers the dev-only seed action, then refreshes the page so the persona
 * cards flip from "missing" to "ready". */
export function SeedButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await seedDevAccountsAction();
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          toast.success(`Đã tạo/đồng bộ ${res.data.seeded} tài khoản test`);
          router.refresh();
        })
      }
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-fg',
        'hover:opacity-90 disabled:opacity-60 transition-opacity',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Tạo / đồng bộ tài khoản test
    </button>
  );
}
