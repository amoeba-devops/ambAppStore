'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { syncUsersFromAmaAction } from '@/server/actions/users/sync-from-ama.action';
import { formatActionError } from '@/lib/format-action-error';

/**
 * Manual "Sync from AMA" button (Option 1b parallel path).
 *
 * Default behaviour is JIT per-user sync via `ensureCarUser` at login. This
 * button is for the edge case where admin needs the local `car_users` cache
 * populated NOW (e.g. before assigning a brand-new MEMBER to a driver record
 * without waiting for that MEMBER to log in first).
 */
export function SyncFromAmaButton() {
  const router = useRouter();
  const t = useTranslations('users.refresh');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const res = await syncUsersFromAmaAction();
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      const { inserted, updated, skipped } = res.data;
      toast.success(t('successToast', { inserted, updated }), {
        description: skipped > 0 ? t('skippedDesc', { count: skipped }) : undefined,
      });
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      onClick={handleClick}
      disabled={pending}
      iconLeft={pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
    >
      <span className="hidden sm:inline">{t('label')}</span>
    </Button>
  );
}
