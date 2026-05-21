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
import type { LocalRole } from '@car-v2/shared/auth';

export type NavKey =
  | 'dashboard' | 'trips' | 'costs' | 'vehicles' | 'drivers'
  | 'users' | 'reports' | 'settings' | 'audit';

export interface NavItem {
  key: NavKey;
  href: string;
  Icon: LucideIcon;
  group: 'workspace' | 'admin';
  /** Roles allowed to see this nav item. */
  roles: readonly LocalRole[];
  staticBadge?: string;
}

const ALL: readonly LocalRole[]    = ['ADMIN', 'MANAGER', 'DRIVER'] as const;
const ADMIN: readonly LocalRole[]  = ['ADMIN'] as const;
const STAFF: readonly LocalRole[]  = ['ADMIN', 'MANAGER'] as const;

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/',         Icon: LayoutDashboard, group: 'workspace', roles: ALL },
  { key: 'trips',     href: '/trips',    Icon: ClipboardList,   group: 'workspace', roles: ALL },
  { key: 'costs',     href: '/costs',    Icon: Receipt,         group: 'workspace', roles: ALL },
  { key: 'vehicles',  href: '/vehicles', Icon: Car,             group: 'workspace', roles: STAFF },
  { key: 'drivers',   href: '/drivers',  Icon: IdCard,          group: 'workspace', roles: STAFF },
  { key: 'reports',   href: '/reports',  Icon: BarChart3,       group: 'workspace', roles: STAFF },
  { key: 'users',     href: '/users',    Icon: UserCog,         group: 'admin',     roles: ADMIN },
  { key: 'settings',  href: '/settings', Icon: SettingsIcon,    group: 'admin',     roles: ADMIN },
  { key: 'audit',     href: '/audit',    Icon: ScrollText,      group: 'admin',     roles: ADMIN },
];

export function navItemsForRole(role: LocalRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

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
