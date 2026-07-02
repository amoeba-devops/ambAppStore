'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, X } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { decideFleetAccessAction } from '@/server/actions/fleet-access/fleet-access.actions';
import { formatActionError } from '@/lib/format-action-error';

export function FleetRequestActions({ requestId }: { requestId: string }) {
  const t = useTranslations('screens.fleetAccess');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
      const res = await decideFleetAccessAction({ requestId, decision });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(decision === 'APPROVED' ? t('approvedToast') : t('rejectedToast'));
      router.refresh();
    });
  };

  return (
    <div className="inline-flex gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="accent"
        disabled={pending}
        onClick={() => decide('APPROVED')}
        iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      >
        {t('approve')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => decide('REJECTED')}
        className="text-danger hover:text-danger hover:bg-danger-soft"
        iconLeft={<X className="h-3.5 w-3.5" />}
      >
        {t('reject')}
      </Button>
    </div>
  );
}
