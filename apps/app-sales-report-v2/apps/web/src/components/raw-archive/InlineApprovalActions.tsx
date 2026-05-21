'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Lock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import {
  approvePeriod,
  rejectPeriod,
  resubmitPeriod,
  unfinalizePeriod,
  lockPeriod,
  type EffectivePeriod,
} from '@/lib/raw-archive-state';

type PendingForm = 'approve' | 'reject' | 'resubmit' | 'unfinalize' | 'lock' | null;

/**
 * Compact, header-friendly version of `ApprovalCard`. Returns the buttons
 * (drop in next to "Open detail") and the inline action form (render
 * between header and file table) as separate pieces so callers can position
 * them independently. State is owned by the caller via `useInlineApproval`.
 *
 * Use:
 * ```
 * const approval = useInlineApproval(period);
 * <div>… {approval.buttons}</div>
 * {approval.form}
 * ```
 */
export function useInlineApproval(period: EffectivePeriod): {
  buttons: React.ReactNode;
  form: React.ReactNode;
} {
  const t = useTranslations('rawArchive.inlineActions');
  const tApproval = useTranslations('rawArchive.approval');
  const [pending, setPending] = useState<PendingForm>(null);
  const [reason, setReason] = useState('');

  const close = () => {
    setPending(null);
    setReason('');
  };

  const open = (v: PendingForm) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setPending(v);
  };

  const buttons = (() => {
    if (period.status === 'Locked') return null;
    if (period.status === 'Draft' && period.rejection) {
      return (
        <button
          type="button"
          onClick={open('resubmit')}
          className="inline-flex items-center gap-1 rounded-md bg-info-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-info-500/90"
        >
          <RefreshCw className="h-3 w-3" />
          {t('resubmit')}
        </button>
      );
    }
    if (period.status === 'Draft') {
      return (
        <>
          <button
            type="button"
            onClick={open('reject')}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <XCircle className="h-3 w-3" />
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={open('approve')}
            className="inline-flex items-center gap-1 rounded-md bg-success-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-success-500/90"
          >
            <CheckCircle2 className="h-3 w-3" />
            {t('approve')}
          </button>
        </>
      );
    }
    // Finalized
    return (
      <>
        <button
          type="button"
          onClick={open('unfinalize')}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <RotateCcw className="h-3 w-3" />
          {t('unfinalize')}
        </button>
        <button
          type="button"
          onClick={open('lock')}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
        >
          <Lock className="h-3 w-3" />
          {t('lock')}
        </button>
      </>
    );
  })();

  const form = pending ? (
    <InlineForm
      pending={pending}
      reason={reason}
      onChange={setReason}
      onCancel={close}
      onConfirm={() => {
        const trimmed = reason.trim();
        if (pending === 'approve') {
          approvePeriod(period.periodKey, trimmed);
        } else if (pending === 'reject') {
          if (trimmed.length === 0) return;
          rejectPeriod(period.periodKey, trimmed);
        } else if (pending === 'resubmit') {
          resubmitPeriod(period.periodKey);
        } else if (pending === 'unfinalize') {
          if (trimmed.length === 0) return;
          unfinalizePeriod(period.periodKey, trimmed);
        } else if (pending === 'lock') {
          lockPeriod(period.periodKey, trimmed);
        }
        close();
      }}
      tApproval={tApproval}
      t={t}
      periodLabel={period.label}
    />
  ) : null;

  return {
    buttons: buttons ? (
      <div className="inline-flex items-center gap-1.5 shrink-0">{buttons}</div>
    ) : null,
    form,
  };
}

interface InlineFormProps {
  pending: Exclude<PendingForm, null>;
  reason: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  periodLabel: string;
  t: ReturnType<typeof useTranslations<'rawArchive.inlineActions'>>;
  tApproval: ReturnType<typeof useTranslations<'rawArchive.approval'>>;
}

function InlineForm({
  pending,
  reason,
  onChange,
  onCancel,
  onConfirm,
  periodLabel,
  t,
  tApproval,
}: InlineFormProps) {
  // Resubmit has no reason input — single confirmation row.
  if (pending === 'resubmit') {
    return (
      <div className="border-t border-neutral-100 bg-info-50/40 px-4 py-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-neutral-700">
          {tApproval('rejected.confirmResubmit')}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {tApproval('cancel')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="rounded-md bg-info-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-info-500/90"
          >
            {tApproval('rejected.confirmYes')}
          </button>
        </div>
      </div>
    );
  }

  const config = (() => {
    if (pending === 'approve') {
      return {
        bg: 'bg-success-500/5 border-success-500/30',
        title: tApproval('draft.confirmApprove', { label: periodLabel }),
        placeholder: tApproval('draft.notePlaceholder'),
        optional: true,
        submitLabel: tApproval('draft.confirmYes'),
        submitClass: 'bg-success-500 hover:bg-success-500/90',
      };
    }
    if (pending === 'reject') {
      return {
        bg: 'bg-error-50/40 border-error-500/30',
        title: tApproval('rejectForm.header'),
        placeholder: tApproval('rejectForm.placeholder'),
        optional: false,
        submitLabel: tApproval('rejectForm.submit'),
        submitClass: 'bg-error-500 hover:bg-error-500/90',
      };
    }
    if (pending === 'unfinalize') {
      return {
        bg: 'bg-warning-500/10 border-warning-500/30',
        title: tApproval('finalized.unfinalizeReason.header'),
        placeholder: tApproval('finalized.unfinalizeReason.placeholder'),
        optional: false,
        submitLabel: tApproval('finalized.unfinalize'),
        submitClass: 'bg-warning-500 hover:bg-warning-500/90',
      };
    }
    return {
      bg: 'bg-neutral-50 border-neutral-200',
      title: tApproval('finalized.lockReason.header'),
      placeholder: tApproval('finalized.lockReason.placeholder'),
      optional: true,
      submitLabel: tApproval('finalized.lock'),
      submitClass: 'bg-neutral-900 hover:bg-neutral-800',
    };
  })();

  const canSubmit = config.optional ? true : reason.trim().length > 0;

  return (
    <div className={cn('border-t border-neutral-100 px-4 py-3 space-y-2', config.bg)}>
      <div className="text-[11px] text-neutral-700 leading-relaxed">{config.title}</div>
      <textarea
        value={reason}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder={config.placeholder}
        rows={2}
        className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-info-500"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {tApproval('cancel')}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={(e) => {
            e.stopPropagation();
            if (canSubmit) onConfirm();
          }}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold text-white transition-colors',
            canSubmit ? config.submitClass : 'bg-neutral-300 cursor-not-allowed',
          )}
        >
          {config.submitLabel}
        </button>
      </div>
      {!config.optional && reason.trim().length === 0 && (
        <p className="text-[10px] text-neutral-400">{t('reasonRequiredHint')}</p>
      )}
    </div>
  );
}
