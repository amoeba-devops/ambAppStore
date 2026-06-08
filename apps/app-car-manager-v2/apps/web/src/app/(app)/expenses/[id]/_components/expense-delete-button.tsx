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
  deleteExpenseAction,
  getExpenseDeleteWarningsAction,
} from '@/server/actions/expenses/expense.actions';

interface ExpenseDeleteButtonProps {
  expenseId: string;
  expenseRef: string;
  redirectTo: string;
}

export function ExpenseDeleteButton({ expenseId, expenseRef, redirectTo }: ExpenseDeleteButtonProps) {
  const t = useTranslations('expenses.detail');
  const tTripStatus = useTranslations('trips.status');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    const result = await deleteExpenseAction(expenseId);
    if (result.success) {
      toast.success(t('tRemoved'));
      router.push(redirectTo);
      router.refresh();
    } else {
      toast.error(t('errRemove'), { description: formatActionError(result.error, tErr) });
      throw new Error('Delete failed'); // Keep dialog open on error
    }
  };

  const fetchDeleteWarnings = async () => {
    const result = await getExpenseDeleteWarningsAction(expenseId);
    if (result.success) {
      // Translate warning messages using i18n and add hrefs
      return result.data.warnings.map((w) => ({
        ...w,
        message:
          w.type === 'has_attachments'
            ? t('warningHasAttachments', { count: w.count })
            : w.type === 'linked_trip'
              ? t('warningLinkedTrip')
              : w.message,
        refs: w.refs?.map((ref) => ({
          ...ref,
          href: w.type === 'linked_trip' ? `/trips/${ref.id}` : undefined,
        })),
      }));
    }
    return [];
  };

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="lg"
        onClick={() => setDeleteDialogOpen(true)}
        iconLeft={<Trash2 />}
      >
        {t('submitRemove')}
      </Button>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('deleteDialogTitle')}
        description={t('confirmRemove', { ref: expenseRef })}
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
