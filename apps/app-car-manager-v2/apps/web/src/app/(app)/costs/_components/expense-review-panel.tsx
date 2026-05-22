'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Receipt, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  toast,
} from '@car-v2/ui';
import type { PendingExpenseListItem } from '@/server/queries/expenses.queries';
import {
  approveExpenseAction,
  rejectExpenseAction,
} from '@/server/actions/expenses/expense.actions';

interface ExpenseReviewPanelProps {
  expense: PendingExpenseListItem;
  /** Hidden read-only mode khi expense đã APPROVED/REJECTED — UI ẩn nút action. */
  canReview: boolean;
  labels: {
    fAmount: string;
    fType: string;
    fLinkedTrip: string;
    fVehicle: string;
    fDriver: string;
    fStatus: string;
    fPending: string;
    fApproved: string;
    fRejected: string;
    reviewNoteLabel: string;
    submittedBy: string;
    receiptTitle: string;
    receipt2: string;
    receiptNote: string;
    rejectReasonPlaceholder: string;
    rejectReasonRequired: string;
    approve: string;
    reject: string;
    approving: string;
    rejecting: string;
    approveSuccess: string;
    rejectSuccess: string;
    typeLabel: string;
  };
  typeLabel: string;
  formatVnd: (v: string) => string;
  formatRelative: (d: Date | string) => string;
  thresholdLabel: string;
}

export function ExpenseReviewPanel({
  expense,
  canReview,
  labels,
  typeLabel,
  formatVnd,
  formatRelative,
  thresholdLabel,
}: ExpenseReviewPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = () => {
    setAction('approve');
    startTransition(async () => {
      const res = await approveExpenseAction({ expense_id: expense.expId });
      if (!res.success) {
        toast.error(res.error.message);
        setAction(null);
        return;
      }
      toast.success(labels.approveSuccess);
      router.refresh();
      setAction(null);
    });
  };

  const handleReject = () => {
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error(labels.rejectReasonRequired);
      return;
    }
    setAction('reject');
    startTransition(async () => {
      const res = await rejectExpenseAction({ expense_id: expense.expId, note: reason });
      if (!res.success) {
        toast.error(res.error.message);
        setAction(null);
        return;
      }
      toast.success(labels.rejectSuccess);
      setRejectReason('');
      setShowRejectInput(false);
      router.refresh();
      setAction(null);
    });
  };

  const statusBadge =
    expense.expStatus === 'PENDING' ? (
      <Badge tone="warning" size="sm">{labels.fPending}</Badge>
    ) : expense.expStatus === 'REJECTED' ? (
      <Badge tone="danger" size="sm">{labels.fRejected}</Badge>
    ) : (
      <Badge tone="success" size="sm">{labels.fApproved}</Badge>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-text-muted tabular">
            EXP-{expense.expId.slice(0, 8).toUpperCase()}
          </div>
          <h2 className="text-xl font-semibold text-text mt-0.5">
            {typeLabel} · {expense.vehiclePlate ?? '—'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {labels.submittedBy}{' '}
            <span className="font-medium text-text">
              {expense.driverName ?? 'Tài xế'}
            </span>{' '}
            · {formatRelative(expense.expSubmittedAt)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">{labels.fAmount}</div>
          <div className="text-3xl font-bold text-text tabular leading-none mt-1">
            {formatVnd(expense.expAmount)}
          </div>
        </div>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <DField label={labels.fType} value={typeLabel} />
            <DField label={labels.fLinkedTrip} value={expense.tripRef ?? '—'} />
            <DField label={labels.fVehicle} value={expense.vehiclePlate ?? '—'} mono />
            <DField label={labels.fDriver} value={expense.driverName ?? '—'} />
            <DField label="Ngưỡng" value={thresholdLabel} />
            <DField label={labels.fStatus} value={statusBadge} />
          </dl>
          {expense.expReviewNote && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-medium text-text-muted mb-1">{labels.reviewNoteLabel}</div>
              <div className="text-sm text-text whitespace-pre-wrap">{expense.expReviewNote}</div>
              {expense.expReviewedAt && (
                <div className="text-xs text-text-faint mt-1">
                  {formatRelative(expense.expReviewedAt)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{labels.receiptTitle}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[3/4] rounded border border-border bg-surface-2 flex items-center justify-center text-text-faint text-xs">
              <Receipt className="h-6 w-6" />
            </div>
            <div className="aspect-[3/4] rounded border border-border bg-surface-2 flex items-center justify-center text-text-faint text-xs">
              {labels.receipt2}
            </div>
          </div>
          <p className="mt-3 text-xs text-text-faint">{labels.receiptNote}</p>
        </CardContent>
      </Card>

      {canReview && (
        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-bg/90 backdrop-blur border-t border-border space-y-3">
          {showRejectInput ? (
            <div className="space-y-2">
              <label htmlFor="rejectReason" className="text-xs font-medium text-text-muted">
                {labels.rejectReasonPlaceholder}
              </label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={labels.rejectReasonPlaceholder}
                disabled={pending}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectReason('');
                  }}
                  disabled={pending}
                >
                  Huỷ
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={handleReject}
                  disabled={pending || rejectReason.trim().length < 3}
                  iconLeft={pending && action === 'reject' ? <Loader2 className="animate-spin" /> : <X />}
                >
                  {pending && action === 'reject' ? labels.rejecting : labels.reject}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="danger"
                size="lg"
                iconLeft={<X />}
                onClick={() => setShowRejectInput(true)}
                disabled={pending}
              >
                {labels.reject}
              </Button>
              <Button
                type="button"
                variant="accent"
                size="lg"
                iconLeft={pending && action === 'approve' ? <Loader2 className="animate-spin" /> : <Check />}
                onClick={handleApprove}
                disabled={pending}
              >
                {pending && action === 'approve' ? labels.approving : labels.approve}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted mb-1">{label}</dt>
      <dd className={mono ? 'font-mono tabular text-text font-medium' : 'text-text font-medium'}>{value}</dd>
    </div>
  );
}
