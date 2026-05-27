'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { syncTenantUsersAction } from '@/server/actions/onboarding/sync-tenant.action';
import { formatActionError } from '@/lib/format-action-error';

/* Single-button onboarding: click → sync → toast + auto-redirect to dashboard.
 *
 * Previously displayed a success card with member counts + a "Continue" CTA,
 * but the extra click is friction — users already see the toast confirming
 * sync count, and middleware now stops gating `/` since `tns_users_synced_at`
 * is non-null. Router.replace (not push) so Browser Back doesn't return to
 * /onboarding which would just re-redirect anyway. */
export function OnboardingForm() {
  const router = useRouter();
  const t = useTranslations('onboarding');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      const res = await syncTenantUsersAction();
      if (!res.success) {
        toast.error(t('errSync'), {
          description: formatActionError(res.error, tErr),
        });
        return;
      }
      const desc =
        res.data.skipped > 0
          ? `${t('successCount', { count: res.data.count })} · ${t('successSkipped', { count: res.data.skipped })}`
          : t('successCount', { count: res.data.count });
      toast.success(t('successTitle'), { description: desc });
      /* `replace` keeps Browser Back working — /onboarding → / replacement
       * means hitting Back from / returns to wherever the user came from
       * (likely the dev-login flow or external link), not back to onboarding
       * which would just redirect again. */
      router.replace('/');
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="accent"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={handleSync}
      iconLeft={pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
    >
      {pending ? t('syncing') : t('startSync')}
    </Button>
  );
}
