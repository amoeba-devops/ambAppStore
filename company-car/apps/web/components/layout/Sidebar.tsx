'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Car, Calendar, Receipt, Users, Settings, FileText, LayoutDashboard } from 'lucide-react';

const NAV = [
  { href: '/dashboard' as const, key: 'dashboard', icon: LayoutDashboard },
  { href: '/trips' as const, key: 'trips', icon: Calendar },
  { href: '/vehicles' as const, key: 'vehicles', icon: Car },
  { href: '/drivers' as const, key: 'drivers', icon: Users },
  { href: '/costs' as const, key: 'costs', icon: Receipt },
  { href: '/reports' as const, key: 'reports', icon: FileText },
  { href: '/settings' as const, key: 'settings', icon: Settings },
];

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-background">
      <div className="px-5 py-5">
        <div className="text-lg font-semibold tracking-tight">Company Car</div>
      </div>
      <nav className="px-3 pb-6">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
