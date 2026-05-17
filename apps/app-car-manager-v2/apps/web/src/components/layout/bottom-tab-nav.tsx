'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, ClipboardList, Receipt, User, type LucideIcon } from 'lucide-react';
import { cn } from '@car-v2/ui';

interface TabItem {
  key: string;
  href: string;
  Icon: LucideIcon;
  matches: (path: string) => boolean;
  labelKey: 'today' | 'trips' | 'expenses' | 'me';
}

/* Driver-centric tab structure per PRD §6.1.4 — bottom tabs replace sidebar on
 * mobile viewports. Tabs are independent of role (server can later filter), but
 * default is the 4-tab Driver view. */
const TABS: TabItem[] = [
  { key: 'today',    href: '/today',    Icon: CalendarClock,  matches: (p) => p === '/today' || p === '/',                labelKey: 'today'    },
  { key: 'trips',    href: '/trips',    Icon: ClipboardList,  matches: (p) => p.startsWith('/trips'),                     labelKey: 'trips'    },
  { key: 'expenses', href: '/costs',    Icon: Receipt,        matches: (p) => p.startsWith('/costs') || p.startsWith('/expenses'), labelKey: 'expenses' },
  { key: 'me',       href: '/settings', Icon: User,           matches: (p) => p.startsWith('/settings') || p.startsWith('/users') || p.startsWith('/me'), labelKey: 'me' },
];

export function BottomTabNav() {
  const pathname = usePathname() ?? '/';
  const tTabs = useTranslations('layout.tabs');
  const tL    = useTranslations('layout');

  return (
    <nav
      aria-label={tL('mobileNavAria')}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 h-14">
        {TABS.map((tab) => {
          const isActive = tab.matches(pathname);
          return (
            <li key={tab.key} className="relative">
              {/* Active indicator — top accent bar */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-180 motion-reduce:transition-none',
                  isActive ? 'w-10 bg-accent' : 'w-0 bg-transparent',
                )}
              />
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  'active:bg-surface-2/60 transition-colors duration-150 motion-reduce:transition-none',
                  isActive ? 'text-accent' : 'text-text-muted',
                )}
              >
                <tab.Icon
                  className={cn('h-[22px] w-[22px] transition-transform duration-180', isActive && 'scale-[1.05]')}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  aria-hidden
                />
                <span className={cn('leading-none', isActive && 'font-semibold')}>{tTabs(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
