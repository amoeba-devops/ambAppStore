'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Plus } from 'lucide-react';
import { Badge, Button, toast } from '@car-v2/ui';
import {
  grantFleetAccessAction,
  revokeFleetAccessAction,
} from '@/server/actions/fleet-access/fleet-access.actions';
import { formatActionError } from '@/lib/format-action-error';
import type { FleetDept } from '@/components/layout/nav-items';

const DEPTS: FleetDept[] = ['CAR', 'TRUCK'];

interface Props {
  userId: string;
  depts: FleetDept[];
  /** ADMIN — implicit full access, no toggles. */
  implicit: boolean;
}

export function FleetMemberControls({ userId, depts, implicit }: Props) {
  const t = useTranslations('screens.fleetAccess');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (implicit) {
    return (
      <Badge tone="accent" size="sm">
        {t('fullAccess')}
      </Badge>
    );
  }

  const toggle = (dept: FleetDept, has: boolean) => {
    startTransition(async () => {
      const res = has
        ? await revokeFleetAccessAction({ userId, vehicleType: dept })
        : await grantFleetAccessAction({ userId, vehicleType: dept });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(has ? t('revokedToast', { dept: t(`dept.${dept}`) }) : t('grantedToast', { dept: t(`dept.${dept}`) }));
      router.refresh();
    });
  };

  return (
    <div className="inline-flex gap-1.5">
      {DEPTS.map((dept) => {
        const has = depts.includes(dept);
        return (
          <Button
            key={dept}
            type="button"
            size="sm"
            variant={has ? 'accent' : 'ghost'}
            disabled={pending}
            onClick={() => toggle(dept, has)}
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
  );
}
