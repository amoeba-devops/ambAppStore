'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, RotateCcw, XCircle, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@v2/ui';
import {
  approvePeriod,
  rejectPeriod,
  resubmitPeriod,
  unfinalizePeriod,
  lockPeriod,
  type EffectivePeriod,
} from '@/lib/raw-archive-state';
import { fmtDateTime } from '@/lib/format';

interface Props {
  period: EffectivePeriod;
}

export function ApprovalCard({ period }: Props) {
  if (period.status === 'Draft') {
    if (period.rejection) return <RejectedCard period={period} />;
    return <DraftApprovalCard period={period} />;
  }
  if (period.status === 'Finalized') return <FinalizedActionsCard period={period} />;
  return null; // Locked — no actions
}

// ----------------------------------------------------------------------------
// Draft state — pending Manager review (no prior rejection)
// ----------------------------------------------------------------------------

function DraftApprovalCard({ period }: Props) {
  const [note, setNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirming, setConfirming] = useState<'approve' | null>(null);

  return (
    <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 px-4 py-3 space-y-3">
      <div className="flex items-start gap-2">
        <Clock className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-warning-500">Pending Manager Approval</h3>
          <p className="mt-0.5 text-[11px] text-neutral-600 leading-relaxed">
            This period is in <span className="font-mono font-semibold">Draft</span>. Manager
            review required before reports can be shared externally.
          </p>
        </div>
      </div>

      {!showRejectForm && (
        <>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
              Note <span className="text-neutral-400 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. All files validated, approving for week"
              rows={2}
              className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-info-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject — back to Operator
            </button>
            <button
              type="button"
              onClick={() => setConfirming('approve')}
              className="inline-flex items-center gap-1.5 rounded-md bg-success-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-success-500/90"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve & Finalize
            </button>
          </div>
        </>
      )}

      {showRejectForm && (
        <RejectForm
          value={rejectReason}
          onChange={setRejectReason}
          onCancel={() => {
            setShowRejectForm(false);
            setRejectReason('');
          }}
          onConfirm={() => {
            rejectPeriod(period.periodKey, rejectReason.trim());
            setShowRejectForm(false);
            setRejectReason('');
          }}
        />
      )}

      {confirming === 'approve' && (
        <ConfirmRow
          message={`Approve ${period.label}? Reports will be marked Finalized and shared.`}
          confirmLabel="Yes, approve"
          confirmTone="success"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            approvePeriod(period.periodKey, note.trim());
            setConfirming(null);
            setNote('');
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Draft state — period was rejected by Manager, waiting Operator to fix
// ----------------------------------------------------------------------------

function RejectedCard({ period }: Props) {
  const rejection = period.rejection!;
  const [confirmingResubmit, setConfirmingResubmit] = useState(false);

  return (
    <div className="rounded-lg border border-error-500/40 bg-error-50/40 px-4 py-3 space-y-3">
      <div className="flex items-start gap-2">
        <XCircle className="h-4 w-4 text-error-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-error-500">Rejected by Manager</h3>
          <p className="mt-0.5 text-[11px] text-neutral-600">
            {fmtDateTime(rejection.rejectedAt)} · {rejection.rejectedBy}
          </p>
          <div className="mt-2 rounded-md border border-error-500/30 bg-white px-3 py-2 text-xs text-neutral-800">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-error-500 mr-1.5">
              Reason
            </span>
            {rejection.rejectedReason}
          </div>
          <p className="mt-2 text-[11px] text-neutral-600 leading-relaxed">
            <span className="font-semibold">Operator action:</span> address the issue (re-upload
            files, fix manual input, or adjust formula), then click Resubmit so the Manager can
            re-review.
          </p>
        </div>
      </div>

      {!confirmingResubmit ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setConfirmingResubmit(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-info-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-info-500/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Resubmit for review
          </button>
        </div>
      ) : (
        <ConfirmRow
          message="Resubmit clears the rejection and sends this period back to Manager review."
          confirmLabel="Yes, resubmit"
          confirmTone="info"
          onCancel={() => setConfirmingResubmit(false)}
          onConfirm={() => {
            resubmitPeriod(period.periodKey);
            setConfirmingResubmit(false);
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Finalized state — Manager can unfinalize
// ----------------------------------------------------------------------------

function FinalizedActionsCard({ period }: Props) {
  const [pendingAction, setPendingAction] = useState<'unfinalize' | 'lock' | null>(null);
  const [reason, setReason] = useState('');

  const resetForm = () => {
    setPendingAction(null);
    setReason('');
  };

  return (
    <div className="rounded-lg border border-info-500/30 bg-info-50/40 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-info-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-info-500">Finalized</h3>
            <p className="mt-0.5 text-[11px] text-neutral-600 leading-relaxed">
              Approved by{' '}
              <span className="font-mono">{period.finalizedBy ?? '—'}</span> on{' '}
              <span className="font-mono">
                {period.finalizedAt ? fmtDateTime(period.finalizedAt) : '—'}
              </span>
              . Reports are locked for this period.
            </p>
          </div>
        </div>
        {pendingAction === null && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPendingAction('unfinalize')}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <RotateCcw className="h-3 w-3" />
              Unfinalize
            </button>
            <button
              type="button"
              onClick={() => setPendingAction('lock')}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
            >
              <Lock className="h-3 w-3" />
              Lock period
            </button>
          </div>
        )}
      </div>

      {pendingAction === 'unfinalize' && (
        <div className="mt-2 rounded-md border border-warning-500/30 bg-white px-3 py-2 space-y-2">
          <div className="text-[11px] text-warning-500 leading-relaxed">
            <span className="font-semibold">Reason required.</span> Unfinalizing reopens this
            period for edits. Action is logged with your user + reason in the audit trail.
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reopening this period?"
            rows={2}
            className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-warning-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={reason.trim().length === 0}
              onClick={() => {
                unfinalizePeriod(period.periodKey, reason.trim());
                resetForm();
              }}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold text-white transition-colors',
                reason.trim().length > 0
                  ? 'bg-warning-500 hover:bg-warning-500/90'
                  : 'bg-neutral-300 cursor-not-allowed',
              )}
            >
              Unfinalize
            </button>
          </div>
        </div>
      )}

      {pendingAction === 'lock' && (
        <div className="mt-2 rounded-md border border-neutral-300 bg-white px-3 py-2 space-y-2">
          <div className="text-[11px] text-neutral-700 leading-relaxed">
            <span className="font-semibold">Locking is permanent for daily operations.</span> No
            more re-uploads or edits on this period. Only Admin can unlock later (with super
            audit log). Reason optional.
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Period closed for accounting"
            rows={2}
            className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                lockPeriod(period.periodKey, reason.trim());
                resetForm();
              }}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              <Lock className="h-3 w-3" />
              Lock period
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Shared bits
// ----------------------------------------------------------------------------

function RejectForm({
  value,
  onChange,
  onCancel,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canConfirm = value.trim().length > 0;
  return (
    <div className="rounded-md border border-error-500/30 bg-white px-3 py-2 space-y-2">
      <div className="text-[11px] text-error-500 leading-relaxed">
        <span className="font-semibold">Reason required.</span> Rejection is logged. The Operator
        will see this note and address it before resubmitting.
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Shopee Sales file W18 is missing 2 days of data"
        rows={3}
        className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-error-500"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-semibold text-white transition-colors',
            canConfirm
              ? 'bg-error-500 hover:bg-error-500/90'
              : 'bg-neutral-300 cursor-not-allowed',
          )}
        >
          Reject — send back to Operator
        </button>
      </div>
    </div>
  );
}

function ConfirmRow({
  message,
  confirmLabel,
  confirmTone,
  onCancel,
  onConfirm,
}: {
  message: string;
  confirmLabel: string;
  confirmTone: 'success' | 'error' | 'info';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-warning-500/20 pt-2">
      <span className="text-[11px] text-neutral-600 mr-auto">{message}</span>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-semibold text-white',
          confirmTone === 'success' && 'bg-success-500 hover:bg-success-500/90',
          confirmTone === 'error' && 'bg-error-500 hover:bg-error-500/90',
          confirmTone === 'info' && 'bg-info-500 hover:bg-info-500/90',
        )}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
