'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { Badge, Button, Input, toast } from '@car-v2/ui';
import {
  closeTruckMonthAction,
  reopenTruckMonthAction,
} from '@/server/actions/settings/truck-finance.actions';
import { formatActionError } from '@/lib/format-action-error';

/**
 * Close / reopen the financial period for a month (REQ-20260623 G1).
 * Closing is ADMIN|MANAGER; reopening is ADMIN only (`canReopen`) — it rewrites
 * an official P&L (REQ-20260629). Server action enforces the same gate.
 */
export function MonthCloseControls({
  month,
  region,
  closed,
  canReopen,
}: {
  month: string;
  region: string;
  closed: boolean;
  canReopen: boolean;
}) {
  const t = useTranslations('screens.truckPnl');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');

  const close = () =>
    start(async () => {
      if (!confirm(t('closeConfirm', { month }))) return;
      const res = await closeTruckMonthAction({ month, region });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('closedToast', { month }));
      router.refresh();
    });

  const reopen = () =>
    start(async () => {
      const res = await reopenTruckMonthAction({ month, region, reason });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('reopenedToast', { month }));
      setReopening(false);
      setReason('');
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={closed ? 'success' : 'warning'} size="sm">
        {closed ? t('statusClosed') : t('statusOpen')}
      </Badge>
      {closed ? (
        !canReopen ? (
          <span className="text-xs text-text-faint">{t('reopenAdminOnly')}</span>
        ) : reopening ? (
          <>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reopenReasonPlaceholder')}
              className="h-8 w-56"
            />
            <Button
              size="sm"
              variant="accent"
              disabled={pending || reason.trim().length < 3}
              onClick={reopen}
              iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockOpen className="h-3.5 w-3.5" />}
            >
              {t('reopen')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setReopening(false); setReason(''); }}>
              {t('cancel')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setReopening(true)} iconLeft={<LockOpen className="h-3.5 w-3.5" />}>
            {t('reopen')}
          </Button>
        )
      ) : (
        <Button
          size="sm"
          variant="accent"
          disabled={pending}
          onClick={close}
          iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
        >
          {t('closeMonth')}
        </Button>
      )}
    </div>
  );
}
