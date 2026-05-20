'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { logoutAction } from '@/server/actions/auth/auth.actions';

/* Logout affordance.
 *
 * Hard navigation (`window.location.href`) after the action so middleware
 * re-runs against the cleared cookie — a soft `router.refresh()` would still
 * trust the now-stale React tree until the next request. */
export function MeLogoutCard() {
  const tMe  = useTranslations('settings.me');
  const tAct = useTranslations('actions');
  const [pending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      await logoutAction();
      window.location.href = '/session-expired';
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-md font-semibold text-text">{tMe('logoutTitle')}</div>
        <p className="text-sm text-text-muted mt-0.5">{tMe('logoutDesc')}</p>
      </div>
      <Button
        variant="danger"
        size="2xl"
        onClick={handle}
        disabled={pending}
        loading={pending}
        iconLeft={<LogOut />}
        className="w-full md:w-auto md:min-w-[200px]"
      >
        {pending ? tMe('logoutPending') : tAct('signOut')}
      </Button>
    </div>
  );
}
