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
import { deleteTruckMaintenanceAction } from '@/server/actions/maintenance/truck-maintenance.actions';
import { formatActionError } from '@/lib/format-action-error';
import { useConfirm } from '@/components/dialogs/use-confirm';

export function ListRowActions({
  editHref,
  deleteId,
  kind,
  confirmText,
}: {
  editHref: string;
  deleteId: string;
  kind: 'vehicle' | 'driver' | 'trip' | 'maintenance';
  confirmText: string;
}) {
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  /* In-app dialog, not window.confirm — that is silently suppressed inside
   * AMA's sandboxed iframe, so the button did nothing (BUG-261005). */
  const del = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await confirm(confirmText))) return;
    start(async () => {
      const res =
        kind === 'vehicle' ? await deleteVehicleAction(deleteId)
        : kind === 'driver' ? await deleteDriverAction(deleteId)
        : kind === 'maintenance' ? await deleteTruckMaintenanceAction({ maintenance_id: deleteId })
        : await deleteTruckTripAction({ trip_id: deleteId });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      /* A sentence, not the bare verb "Xoá" the toast used to show. */
      toast.success(tA('deleted'));
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
      {/* Portalled, but React events still bubble through the tree — the
        * wrapper's stopPropagation keeps a dialog click from opening the row. */}
      {dialog}
    </div>
  );
}
