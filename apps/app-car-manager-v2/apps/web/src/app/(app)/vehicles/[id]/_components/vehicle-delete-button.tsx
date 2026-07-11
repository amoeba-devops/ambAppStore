'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button, toast } from '@car-v2/ui';
import { ConfirmDeleteDialog, type DeleteWarningRef } from '@/components/dialogs/confirm-delete-dialog';
import { RefDetailPanel } from '@/components/dialogs/ref-detail-panel';
import { formatActionError } from '@/lib/format-action-error';
import {
  deleteVehicleAction,
  getVehicleDeleteWarningsAction,
} from '@/server/actions/vehicles/vehicle.actions';

interface VehicleDeleteButtonProps {
  vehicleId: string;
  plateNumber: string;
  /** Button variant - 'danger' for full button, 'ghost' for icon-only */
  variant?: 'danger' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
}

export function VehicleDeleteButton({
  vehicleId,
  plateNumber,
  variant = 'danger',
  size = 'md',
}: VehicleDeleteButtonProps) {
  const t = useTranslations('vehicles.form');
  const tTripStatus = useTranslations('trips.status');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    const result = await deleteVehicleAction(vehicleId);
    if (result.success) {
      toast.success(t('tRemoved'));
      router.push('/vehicles');
      router.refresh();
    } else {
      toast.error(t('errRemove'), { description: formatActionError(result.error, tErr) });
      throw new Error('Delete failed'); // Keep dialog open on error
    }
  };

  const fetchDeleteWarnings = async () => {
    const result = await getVehicleDeleteWarningsAction(vehicleId);
    if (result.success) {
      return result.data.warnings.map((w) => ({
        ...w,
        message:
          w.type === 'active_trips'
            ? t('warningActiveTrips', { count: w.count })
            : w.type === 'linked_expenses'
              ? t('warningLinkedExpenses', { count: w.count })
              : w.message,
        refs: w.refs?.map((ref) => ({
          ...ref,
          href: w.type === 'active_trips' ? `/trips/${ref.id}` : `/costs?highlight=${ref.id}`,
        })),
      }));
    }
    return [];
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setDeleteDialogOpen(true)}
        iconLeft={<Trash2 />}
        aria-label={variant === 'ghost' ? t('submitRemove') : undefined}
        className={variant === 'ghost' ? 'px-2' : undefined}
      >
        {variant === 'ghost' ? null : t('submitRemove')}
      </Button>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('deleteDialogTitle')}
        description={t('confirmRemove', { plate: plateNumber })}
        confirmLabel={t('submitRemove')}
        cancelLabel={tA('cancel')}
        onConfirm={handleDelete}
        fetchWarnings={fetchDeleteWarnings}
        locale={locale}
        warningLabels={{
          loading: t('deleteWarningsLoading'),
          hasWarnings: t('deleteWarningsFound'),
          noWarnings: t('deleteNoWarnings'),
          more: (count) => t('warningMore', { count }),
          relatedTitle: t('relatedTrips'),
          viewFullDetails: t('viewFullDetails'),
          tripStatus: (status) => tTripStatus(status),
        }}
        renderRefDetail={(ref: DeleteWarningRef) => <RefDetailPanel refData={ref} />}
      />
    </>
  );
}
