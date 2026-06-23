'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Car, Loader2, Plus, Truck, type LucideIcon } from 'lucide-react';
import { cn, toast } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { requestFleetAccessAction } from '@/server/actions/fleet-access/fleet-access.actions';
import { formatActionError } from '@/lib/format-action-error';
import { useActiveDept } from './dept-context';
import { type FleetDept } from './nav-items';

interface Props {
  role: LocalRole;
  fleetAccess: FleetDept[];
  collapsed: boolean;
}

/* Car landing = schedule dashboard; truck landing = truck dashboard. */
const CAR_HOME = '/dashboard';
const TRUCK_HOME = '/truck/dashboard';

export function DeptSwitch({ role, fleetAccess, collapsed }: Props) {
  const t = useTranslations('layout.dept');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();

  const current = useActiveDept();
  const hasCar = fleetAccess.includes('CAR');
  const hasTruck = fleetAccess.includes('TRUCK');

  /* Both departments → segmented toggle between the two workspaces. */
  if (hasCar && hasTruck) {
    return (
      <div className={cn('flex gap-1 rounded-md bg-surface-2 p-1', collapsed && 'flex-col')}>
        <DeptLink href={CAR_HOME} active={current === 'CAR'} Icon={Car} label={t('car')} collapsed={collapsed} />
        <DeptLink href={TRUCK_HOME} active={current === 'TRUCK'} Icon={Truck} label={t('truck')} collapsed={collapsed} />
      </div>
    );
  }

  /* Manager with car only → self-service request for truck access. */
  if (role === 'MANAGER' && hasCar && !hasTruck && !collapsed) {
    const request = () => {
      startTransition(async () => {
        const res = await requestFleetAccessAction({ vehicleType: 'TRUCK' });
        if (!res.success) {
          toast.error(formatActionError(res.error, tErr));
          return;
        }
        toast.success(t('requestSent'));
      });
    };
    return (
      <button
        type="button"
        onClick={request}
        disabled={pending}
        className={cn(
          'w-full flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium',
          'text-text-muted hover:text-accent hover:border-accent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        <span className="truncate">{t('requestTruck')}</span>
      </button>
    );
  }

  /* Single-department user (one membership only: a department-scoped manager/
   * admin, or a driver) → a non-interactive workspace badge so they always know
   * which fleet they're operating on, even though there's nothing to switch to. */
  if (hasCar || hasTruck) {
    const Icon = current === 'TRUCK' ? Truck : Car;
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-xs font-semibold text-text-muted',
          collapsed && 'justify-center',
        )}
        title={t(current === 'TRUCK' ? 'truck' : 'car')}
        aria-label={t(current === 'TRUCK' ? 'truck' : 'car')}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        {!collapsed && <span className="truncate">{t(current === 'TRUCK' ? 'truck' : 'car')}</span>}
      </div>
    );
  }

  return null;
}

function DeptLink({
  href,
  active,
  Icon,
  label,
  collapsed,
}: {
  href: string;
  active: boolean;
  Icon: LucideIcon;
  label: string;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex-1 inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-accent text-accent-fg shadow-sm' : 'text-text-muted hover:text-text',
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
