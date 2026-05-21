'use client';

import Link from 'next/link';
import {
  Upload,
  Archive,
  BarChart3,
  CalendarRange,
  TrendingUp,
  Database,
  Users,
  SlidersHorizontal,
  ScrollText,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LocalRole } from '@v2/shared/auth';

interface ActionSpec {
  key:
    | 'upload'
    | 'rawArchive'
    | 'weekly'
    | 'monthly'
    | 'trending'
    | 'primeCost'
    | 'users'
    | 'formulaConfig'
    | 'activityLog';
  href: string;
  icon: LucideIcon;
  roles: readonly LocalRole[];
  /** Tailwind color class for the icon backdrop. */
  iconClass: string;
}

const ACTIONS: ActionSpec[] = [
  {
    key: 'upload',
    href: '/upload',
    icon: Upload,
    roles: ['OPERATOR', 'ADMIN'],
    iconClass: 'bg-info-50 text-info-500',
  },
  {
    key: 'rawArchive',
    href: '/raw-archive',
    icon: Archive,
    roles: ['OPERATOR', 'MANAGER', 'ADMIN'],
    iconClass: 'bg-warning-50 text-warning-500',
  },
  {
    key: 'weekly',
    href: '/reports/weekly',
    icon: BarChart3,
    roles: ['OPERATOR', 'MANAGER', 'ADMIN'],
    iconClass: 'bg-success-500/10 text-success-500',
  },
  {
    key: 'monthly',
    href: '/reports/monthly',
    icon: CalendarRange,
    roles: ['OPERATOR', 'MANAGER', 'ADMIN'],
    iconClass: 'bg-success-500/10 text-success-500',
  },
  {
    key: 'trending',
    href: '/reports/trending',
    icon: TrendingUp,
    roles: ['OPERATOR', 'MANAGER', 'ADMIN'],
    iconClass: 'bg-accent-50 text-accent-700',
  },
  {
    key: 'primeCost',
    href: '/cost-master/prime-cost',
    icon: Database,
    roles: ['OPERATOR', 'ADMIN'],
    iconClass: 'bg-neutral-100 text-neutral-700',
  },
  {
    key: 'activityLog',
    href: '/activity-log/action',
    icon: ScrollText,
    roles: ['MANAGER', 'ADMIN'],
    iconClass: 'bg-warning-500/10 text-warning-500',
  },
  {
    key: 'users',
    href: '/settings/users',
    icon: Users,
    roles: ['ADMIN'],
    iconClass: 'bg-info-500/10 text-info-500',
  },
  {
    key: 'formulaConfig',
    href: '/settings/formula-config',
    icon: SlidersHorizontal,
    roles: ['ADMIN'],
    iconClass: 'bg-info-500/10 text-info-500',
  },
];

interface Props {
  role: LocalRole;
}

export function QuickActions({ role }: Props) {
  const t = useTranslations('dashboard.actions');
  const visible = ACTIONS.filter((a) => a.roles.includes(role));

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-neutral-900">{t('sectionTitle')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.key}
              href={a.href}
              className="group flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${a.iconClass}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                  <span className="truncate">{t(a.key)}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{t(`${a.key}Desc`)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
