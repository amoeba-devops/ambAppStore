'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Edit3, Loader2, Trash2 } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { deleteTruckTripAction } from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';
import { useConfirm } from '@/components/dialogs/use-confirm';

export function TruckTripManageActions({ tripId }: { tripId: string }) {
  const t = useTranslations('screens.truckTripDetail');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  /* In-app dialog, not window.confirm — that is silently suppressed inside
   * AMA's sandboxed iframe, so the button did nothing (BUG-261005). */
  const del = async () => {
    if (!(await confirm(t('deleteConfirm')))) return;
    startTransition(async () => {
      const res = await deleteTruckTripAction({ trip_id: tripId });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('deletedToast'));
      router.push('/truck/trips');
      router.refresh();
    });
  };

  return (
    <div className="inline-flex gap-2">
      <Button asChild variant="secondary" size="md" iconLeft={<Edit3 />}>
        <Link href={`/truck/trips/${tripId}/edit`}>{t('edit')}</Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="md"
        disabled={pending}
        onClick={del}
        className="text-danger hover:text-danger hover:bg-danger-soft"
        iconLeft={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      >
        {t('delete')}
      </Button>
      {dialog}
    </div>
  );
}
