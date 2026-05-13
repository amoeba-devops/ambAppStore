import {
  ClipboardList,
  Car,
  IdCard,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  UserCog,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

export type NavKey =
  | 'dashboard' | 'trips' | 'costs' | 'vehicles' | 'drivers'
  | 'users' | 'reports' | 'settings' | 'audit';

export interface NavItem {
  key: NavKey;
  href: string;
  Icon: LucideIcon;
  group: 'workspace' | 'admin';
  staticBadge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/',         Icon: LayoutDashboard, group: 'workspace' },
  { key: 'trips',     href: '/trips',    Icon: ClipboardList,   group: 'workspace', staticBadge: '12' },
  { key: 'costs',     href: '/costs',    Icon: Receipt,         group: 'workspace', staticBadge: '4' },
  { key: 'vehicles',  href: '/vehicles', Icon: Car,             group: 'workspace' },
  { key: 'drivers',   href: '/drivers',  Icon: IdCard,          group: 'workspace' },
  { key: 'users',     href: '/users',    Icon: UserCog,         group: 'workspace' },
  { key: 'reports',   href: '/reports',  Icon: BarChart3,       group: 'workspace' },
  { key: 'settings',  href: '/settings', Icon: SettingsIcon,    group: 'admin' },
  { key: 'audit',     href: '/audit',    Icon: ScrollText,      group: 'admin' },
];

/** Pick the active nav key for a given pathname; longest prefix wins. */
export function activeKeyFor(pathname: string): NavKey {
  if (pathname === '/') return 'dashboard';
  let bestKey: NavKey = 'dashboard';
  let bestLen = 0;
  for (const item of NAV_ITEMS) {
    if (item.href !== '/' && pathname.startsWith(item.href) && item.href.length > bestLen) {
      bestKey = item.key;
      bestLen = item.href.length;
    }
  }
  return bestKey;
}
