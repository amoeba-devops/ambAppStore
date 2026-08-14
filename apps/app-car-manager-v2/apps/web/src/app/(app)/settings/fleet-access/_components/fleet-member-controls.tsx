'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Plus } from 'lucide-react';
import { Badge, Button, toast } from '@car-v2/ui';
import {
  grantFleetAccessAction,
  revokeFleetAccessAction,
  getFleetAccessRevokeWarningsAction,
} from '@/server/actions/fleet-access/fleet-access.actions';
import { ConfirmDeleteDialog } from '@/components/dialogs/confirm-delete-dialog';
import { formatActionError } from '@/lib/format-action-error';
import type { FleetDept } from '@/components/layout/nav-items';

const DEPTS: FleetDept[] = ['CAR', 'TRUCK'];

interface Props {
  userId: string;
  /** Display name shown in the revoke confirmation dialog. */
  memberName: string;
  depts: FleetDept[];
  /** ADMIN — implicit full access, no toggles. */
  implicit: boolean;
}

export function FleetMemberControls({ userId, memberName, depts, implicit }: Props) {
  const t = useTranslations('screens.fleetAccess');
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDept, setConfirmDept] = useState<FleetDept | null>(null);

  if (implicit) {
    return (
      <Badge tone="accent" size="sm">
        {t('fullAccess')}
      </Badge>
    );
  }

  const doGrant = (dept: FleetDept) => {
    startTransition(async () => {
      const res = await grantFleetAccessAction({ userId, vehicleType: dept });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('grantedToast', { dept: t(`dept.${dept}`) }));
      router.refresh();
    });
  };

  const doRevoke = async () => {
    if (!confirmDept) return;
    const res = await revokeFleetAccessAction({ userId, vehicleType: confirmDept });
    if (!res.success) {
      toast.error(formatActionError(res.error, tErr));
      throw new Error('revoke failed'); // keep dialog open on error
    }
    toast.success(t('revokedToast', { dept: t(`dept.${confirmDept}`) }));
    router.refresh();
  };

  const fetchRevokeWarnings = async () => {
    if (!confirmDept) return [];
    const res = await getFleetAccessRevokeWarningsAction({ userId, vehicleType: confirmDept });
    if (res.success) {
      return res.data.warnings.map((w) => ({
        ...w,
        message: t('warningDefaultDriverVehicles', { count: w.count }),
      }));
    }
    return [];
  };

  return (
    <>
      {/* Left-aligned and wrapping on phones (the mobile card gives these their
        * own row); inline inside the desktop table cell. */}
      <div className="flex flex-wrap gap-2 md:inline-flex md:gap-1.5">
        {DEPTS.map((dept) => {
          const has = depts.includes(dept);
          return (
            <Button
              key={dept}
              type="button"
              size="sm"
              variant={has ? 'accent' : 'ghost'}
              disabled={pending}
              /* >=44px touch target on mobile, compact from md: up. */
              className="min-h-[44px] md:min-h-0"
              onClick={() => (has ? setConfirmDept(dept) : doGrant(dept))}
              iconLeft={
                pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : has ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )
              }
            >
              {t(`dept.${dept}`)}
            </Button>
          );
        })}
      </div>

      <ConfirmDeleteDialog
        open={confirmDept !== null}
        onOpenChange={(o) => !o && setConfirmDept(null)}
        title={t('revokeDialogTitle', { dept: confirmDept ? t(`dept.${confirmDept}`) : '' })}
        description={t('revokeConfirmDesc', {
          dept: confirmDept ? t(`dept.${confirmDept}`) : '',
          name: memberName,
        })}
        confirmLabel={t('revokeSubmit')}
        cancelLabel={tA('cancel')}
        onConfirm={doRevoke}
        fetchWarnings={fetchRevokeWarnings}
        warningLabels={{
          loading: t('revokeWarningsLoading'),
          hasWarnings: t('revokeWarningsFound'),
          noWarnings: t('revokeNoWarnings'),
        }}
      />
    </>
  );
}
