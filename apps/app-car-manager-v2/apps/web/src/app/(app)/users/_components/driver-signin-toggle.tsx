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
  amaUserId: string;
  displayName: string;
  /** Current status from AMA: ACTIVE / INACTIVE / SUSPENDED. */
  currentStatus: string;
  /** Compact mode — icon only, small size (used in dense tables). Default false. */
  compact?: boolean;
}

export function DriverSigninToggle({
  amaUserId,
  displayName,
  currentStatus,
  compact = false,
}: DriverSigninToggleProps) {
  const router = useRouter();
  const t = useTranslations('users.signin');
  const tStatus = useTranslations('users.statusBadge');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const isCurrentlyActive = currentStatus === 'ACTIVE';
  const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
  const verb = isCurrentlyActive ? t('lockSignin') : t('unlockSignin');

  const doToggle = () => {
    startTransition(async () => {
      const res = await updateMemberAction({
        userId: amaUserId,
        status: nextStatus,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(
        isCurrentlyActive
          ? t('lockedToast', { name: displayName })
          : t('unlockedToast', { name: displayName }),
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
            (isCurrentlyActive
              ? 'text-danger hover:text-danger hover:bg-danger-soft'
              : 'text-success hover:text-success hover:bg-success-soft')
          }
          iconLeft={isCurrentlyActive ? <Lock /> : <Unlock />}
        >
          {isCurrentlyActive ? t('btnLocked') : t('btnUnlocked')}
        </Button>
      ) : (
        <Button
          type="button"
          variant={isCurrentlyActive ? 'ghost' : 'accent'}
          size="sm"
          onClick={() => setOpen(true)}
          className={
            isCurrentlyActive
              ? 'text-danger hover:text-danger hover:bg-danger-soft'
              : ''
          }
          iconLeft={isCurrentlyActive ? <Lock /> : <Unlock />}
        >
          {verb}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isCurrentlyActive ? 'text-danger' : 'text-success'}`}>
              {isCurrentlyActive ? <AlertTriangle className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              {isCurrentlyActive ? t('confirmTitleLock') : t('confirmTitleUnlock')}
            </DialogTitle>
            <DialogDescription>
              {isCurrentlyActive ? t('descLock') : t('descUnlock')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-surface-2 p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">{t('rowDriver')}</span>
                <span className="font-medium text-text">{displayName}</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-text-muted">{t('rowStatus')}</span>
                <span className="font-mono text-xs tabular">
                  <span className={isCurrentlyActive ? 'text-success line-through' : 'text-danger line-through'}>
                    {tStatus(currentStatus as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')}
                  </span>
                  <span className="mx-1.5 text-text-faint">→</span>
                  <span className={isCurrentlyActive ? 'text-danger font-bold' : 'text-success font-bold'}>
                    {tStatus(nextStatus)}
                  </span>
                </span>
              </div>
            </div>

            {isCurrentlyActive ? (
              <div className="rounded-md bg-warning-soft/40 border border-warning/30 p-3 text-xs text-text leading-relaxed">
                <strong className="text-warning-strong">{t('afterLockTitle')}</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>{t('afterLock1')}</li>
                  <li>{t('afterLock2')}</li>
                  <li>{t('afterLock3')}</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-md bg-success-soft/40 border border-success/30 p-3 text-xs text-text leading-relaxed">
                <strong className="text-success">{t('afterUnlockTitle')}</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>{t('afterUnlock1')}</li>
                  <li>{t('afterUnlock2')}</li>
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
              variant={isCurrentlyActive ? 'danger' : 'accent'}
              onClick={doToggle}
              disabled={pending}
              iconLeft={
                pending ? <Loader2 className="animate-spin" /> :
                isCurrentlyActive ? <Lock /> : <Unlock />
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
