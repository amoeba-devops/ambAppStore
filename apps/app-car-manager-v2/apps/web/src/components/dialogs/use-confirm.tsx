'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDeleteDialog, type DeleteWarning, type DeleteWarningRef } from './confirm-delete-dialog';

type ConfirmDialogProps = React.ComponentProps<typeof ConfirmDeleteDialog>;

interface ConfirmRequest {
  message: string;
  title?: string;
  confirmLabel?: string;
  /** Knock-on effects shown inside the dialog before the user confirms
   * (loaded when it opens). Omit for a plain yes/no confirmation. */
  fetchWarnings?: () => Promise<DeleteWarning[]>;
  warningLabels?: ConfirmDialogProps['warningLabels'];
  renderRefDetail?: (ref: DeleteWarningRef) => React.ReactNode;
}

/**
 * Promise-based replacement for `window.confirm()` (BUG-261005).
 *
 * The app runs inside AMA's iframe, whose `sandbox` has no `allow-modals`. In
 * that context the browser suppresses `confirm()`/`alert()`/`prompt()`: the call
 * returns `false` instantly and shows nothing — so every "Xoá" button guarded
 * by `if (!confirm(...)) return;` silently did nothing. Opened outside the
 * iframe it worked, which is why it slipped through.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm(t('deleteConfirm')))) return;
 *   ...
 *   return <>{...}{dialog}</>;
 */
export function useConfirm() {
  const tA = useTranslations('actions');
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback(
    (message: string, opts: Omit<ConfirmRequest, 'message'> = {}) =>
      new Promise<boolean>((resolve) => {
        /* A second request while one is open cancels the first. */
        resolver.current?.(false);
        resolver.current = resolve;
        setRequest({ message, ...opts });
      }),
    [],
  );

  const dialog = (
    <ConfirmDeleteDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={request?.title ?? tA('confirmDeleteTitle')}
      description={request?.message ?? ''}
      confirmLabel={request?.confirmLabel ?? tA('delete')}
      cancelLabel={tA('cancel')}
      onConfirm={() => settle(true)}
      fetchWarnings={request?.fetchWarnings}
      warningLabels={request?.warningLabels}
      renderRefDetail={request?.renderRefDetail}
    />
  );

  return { confirm, dialog };
}
