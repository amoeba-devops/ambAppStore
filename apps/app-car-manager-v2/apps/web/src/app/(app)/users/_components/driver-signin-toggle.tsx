'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, Lock, Unlock } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@car-v2/ui';
import { updateMemberAction } from '@/server/actions/users/update-member.action';
import { formatActionError } from '@/lib/format-action-error';

interface DriverSigninToggleProps {
  /** car_users.usrId (same as AMA user id — kept name for backward UI compat). */
  amaUserId: string;
  displayName: string;
  /** True when `car_users.usr_deleted_at IS NOT NULL` — user is locked out of car-v2. */
  blocked: boolean;
  /** Compact mode — icon only, small size (used in dense tables). Default false. */
  compact?: boolean;
}

/**
 * Toggle a driver's access to car-v2 specifically. Implemented as a soft-delete
 * on `car_users` (local-only — does NOT touch AMA's member status, so the user
 * can still sign in to other Amoeba apps).
 */
export function DriverSigninToggle({
  amaUserId,
  displayName,
  blocked,
  compact = false,
}: DriverSigninToggleProps) {
  const router = useRouter();
  const t = useTranslations('users.signin');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const verb = blocked ? t('unlockSignin') : t('lockSignin');

  const doToggle = () => {
    startTransition(async () => {
      const res = await updateMemberAction({
        userId: amaUserId,
        blocked: !blocked,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(
        blocked
          ? t('unlockedToast', { name: displayName })
          : t('lockedToast', { name: displayName }),
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`${verb} ${displayName}`}
          title={verb}
          className={
            'text-xs ' +
            (blocked
              ? 'text-success hover:text-success hover:bg-success-soft'
              : 'text-danger hover:text-danger hover:bg-danger-soft')
          }
          iconLeft={blocked ? <Unlock /> : <Lock />}
        >
          {blocked ? t('btnUnlocked') : t('btnLocked')}
        </Button>
      ) : (
        <Button
          type="button"
          variant={blocked ? 'accent' : 'ghost'}
          size="sm"
          onClick={() => setOpen(true)}
          className={
            blocked ? '' : 'text-danger hover:text-danger hover:bg-danger-soft'
          }
          iconLeft={blocked ? <Unlock /> : <Lock />}
        >
          {verb}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${blocked ? 'text-success' : 'text-danger'}`}>
              {blocked ? <Unlock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {blocked ? t('confirmTitleUnlock') : t('confirmTitleLock')}
            </DialogTitle>
            <DialogDescription>
              {blocked ? t('descUnlock') : t('descLock')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-surface-2 p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">{t('rowDriver')}</span>
                <span className="font-medium text-text">{displayName}</span>
              </div>
            </div>

            {blocked ? (
              <div className="rounded-md bg-success-soft/40 border border-success/30 p-3 text-xs text-text leading-relaxed">
                <strong className="text-success">{t('afterUnlockTitle')}</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>{t('afterUnlock1')}</li>
                  <li>{t('afterUnlock2')}</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-md bg-warning-soft/40 border border-warning/30 p-3 text-xs text-text leading-relaxed">
                <strong className="text-warning-strong">{t('afterLockTitle')}</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>{t('afterLock1')}</li>
                  <li>{t('afterLock2')}</li>
                  <li>{t('afterLock3')}</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant={blocked ? 'accent' : 'danger'}
              onClick={doToggle}
              disabled={pending}
              iconLeft={
                pending ? <Loader2 className="animate-spin" /> :
                blocked ? <Unlock /> : <Lock />
              }
            >
              {pending ? t('pending') : verb}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
