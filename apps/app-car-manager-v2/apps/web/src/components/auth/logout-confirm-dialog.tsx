'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, LogOut } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@car-v2/ui';
import { clearBrowserSession } from '@/lib/clear-browser-session';

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Performs the actual sign-out (server-action redirect or a route navigation).
   * Runs AFTER local caches are cleared. Typically navigates away and never
   * returns, so the busy state stays on until the page swaps.
   */
  perform: () => void | Promise<void>;
}

/**
 * Confirm-before-logout dialog. Explains that signing out wipes this browser's
 * session caches (drafts, filters, view prefs) while keeping notifications, then
 * clears them and hands off to `perform`.
 *
 * Works embedded in the AMA iframe (Radix renders into the iframe's own
 * document) and is responsive: buttons stack full-width on mobile, sit inline
 * on desktop. While busy we block all dismissals (overlay, Esc, X) so the wipe
 * + redirect can't be interrupted half-way.
 */
export function LogoutConfirmDialog({ open, onOpenChange, perform }: LogoutConfirmDialogProps) {
  const t = useTranslations('logout');
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    try {
      await clearBrowserSession();
      await perform();
    } catch {
      /* perform threw without navigating — let the user retry */
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        size="sm"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('desc')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed">
          <p className="font-medium text-text-faint uppercase tracking-wide">{t('clearsLabel')}</p>
          <p className="mt-1 text-text-muted">{t('clearsItems')}</p>
          <div className="mt-2 flex items-center gap-2 text-success">
            <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-medium">{t('keepsNoti')}</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            size="md"
            className="w-full sm:w-auto"
            iconLeft={<LogOut />}
            loading={busy}
            onClick={onConfirm}
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
