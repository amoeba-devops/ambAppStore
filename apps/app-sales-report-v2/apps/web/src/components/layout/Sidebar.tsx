'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import type { LocalRole } from '@v2/shared/auth';
import { usePendingApprovalCount } from '@/lib/raw-archive-state';
import { navSections, filterNavByRole, type NavItem } from './nav-config';

interface SidebarProps {
  role: LocalRole;
  /** Period keys present in the real archive (from server). Used to compute pending-approval badge. */
  realPeriodKeys?: string[];
}

export function Sidebar({ role, realPeriodKeys = [] }: SidebarProps) {
  const pathname = usePathname();
  const sections = filterNavByRole(navSections, role);
  const pendingCount = usePendingApprovalCount(realPeriodKeys);
  const tApp = useTranslations('app');
  const tSection = useTranslations('nav.section');
  const tItem = useTranslations('nav.item');
  const tBadge = useTranslations('nav.badge');

  function badgeFor(item: NavItem): number | null {
    if (item.badge === 'pending-approval' && pendingCount > 0) return pendingCount;
    return null;
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-neutral-100 lg:flex lg:flex-col">
      <div className="flex h-14 items-center border-b border-neutral-200 px-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-neutral-900">
          {tApp('name')}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, idx) => (
          <div key={section.titleKey ?? idx} className={idx > 0 ? 'mt-6' : ''}>
            {section.titleKey && (
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {tSection(section.titleKey)}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                const badge = badgeFor(item);
                const label = tItem(item.labelKey);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-neutral-200 font-medium text-neutral-900'
                          : 'text-neutral-700 hover:bg-neutral-150 hover:text-neutral-900',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-neutral-600 group-hover:text-neutral-900" />
                      <span className="truncate flex-1">{label}</span>
                      {badge !== null && (
                        <span
                          className="inline-flex items-center justify-center rounded-full bg-warning-500 px-1.5 min-w-[18px] h-[18px] text-[10px] font-semibold text-white tabular-nums"
                          title={tBadge('pendingApproval', { count: badge })}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-neutral-200 px-4 py-3">
        <div className="font-mono text-[10px] text-neutral-500">{tApp('version')}</div>
      </div>
    </aside>
  );
}
