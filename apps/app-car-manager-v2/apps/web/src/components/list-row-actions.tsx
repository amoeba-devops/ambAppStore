'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@car-v2/ui';
import { deleteVehicleAction } from '@/server/actions/vehicles/vehicle.actions';
import { deleteDriverAction } from '@/server/actions/drivers/driver.actions';
import { deleteTruckTripAction } from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';

export function ListRowActions({
  editHref,
  deleteId,
  kind,
  confirmText,
}: {
  editHref: string;
  deleteId: string;
  kind: 'vehicle' | 'driver' | 'trip';
  confirmText: string;
}) {
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();

  const del = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(confirmText)) return;
    start(async () => {
      const res =
        kind === 'vehicle' ? await deleteVehicleAction(deleteId)
        : kind === 'driver' ? await deleteDriverAction(deleteId)
        : await deleteTruckTripAction({ trip_id: deleteId });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(tA('delete'));
      router.refresh();
    });
  };

  const btn =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Link href={editHref} aria-label={tA('edit')} title={tA('edit')} className={btn} onClick={(e) => e.stopPropagation()}>
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        aria-label={tA('delete')}
        title={tA('delete')}
        disabled={pending}
        onClick={del}
        className={`${btn} hover:text-danger`}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
