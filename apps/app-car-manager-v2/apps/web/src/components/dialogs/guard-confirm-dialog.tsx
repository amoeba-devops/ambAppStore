'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@car-v2/ui';
import {
  CONFIRM_REQUIRED_CODE,
  isConfirmRequiredDetails,
  type AssignmentWarning,
} from '@car-v2/shared/errors';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { formatAssignmentWarning } from '@/lib/assignment-warnings';

/**
 * Assignment-guard confirm flow, client half (shared by every trip form):
 *
 *   const guard = useGuardConfirm();
 *   ...inside the submit handler, after the action returns a failure:
 *   if (guard.intercept(result.error, (codes) => doSubmit(codes))) return;
 *   ...in JSX:
 *   <GuardConfirmDialog state={guard.dialog} pending={pending} />
 *
 * `intercept` returns true when the failure is a CONFIRM_REQUIRED refusal —
 * the dialog opens listing the warnings; "proceed" resubmits through the
 * caller-provided retry with the confirmed codes; "cancel" just closes.
 */
export interface GuardDialogState {
  warnings: AssignmentWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function useGuardConfirm(): {
  intercept: (
    error: { code: string; details?: unknown },
    retry: (confirmedCodes: string[]) => void,
  ) => boolean;
  dialog: GuardDialogState | null;
} {
  const [state, setState] = useState<{
    warnings: AssignmentWarning[];
    retry: (confirmedCodes: string[]) => void;
  } | null>(null);

  return {
    intercept(error, retry) {
      if (error.code !== CONFIRM_REQUIRED_CODE || !isConfirmRequiredDetails(error.details)) {
        return false;
      }
      setState({ warnings: error.details.warnings, retry });
      return true;
    },
    dialog: state
      ? {
          warnings: state.warnings,
          onConfirm: () => {
            const s = state;
            setState(null);
            s.retry(s.warnings.map((w) => w.code));
          },
          onCancel: () => setState(null),
        }
      : null,
  };
}

export function GuardConfirmDialog({
  state,
  pending,
}: {
  state: GuardDialogState | null;
  pending?: boolean;
}) {
  const t = useTranslations();

  return (
    <BottomSheet open={state !== null} onOpenChange={(o) => !o && state?.onCancel()}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{t('guard.dialogTitle')}</BottomSheetTitle>
          <BottomSheetDescription>{t('guard.dialogDesc')}</BottomSheetDescription>
        </BottomSheetHeader>
        <ul className="mt-4 space-y-2">
          {state?.warnings.map((w) => (
            <li
              key={w.code}
              className="flex items-start gap-2 rounded border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-text"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
              <span>{formatAssignmentWarning(w, t)}</span>
            </li>
          ))}
        </ul>
        <BottomSheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => state?.onCancel()}>
            {t('actions.cancel')}
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => state?.onConfirm()}>
            {t('guard.confirm')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
