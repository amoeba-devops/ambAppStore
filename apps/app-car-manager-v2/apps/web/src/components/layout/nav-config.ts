import type { IconName } from '../primitives/icon';

/** Single source of truth cho sidebar nav. Mỗi nav key map 1 route prefix. */
export type NavKey =
  | 'dashboard' | 'trips' | 'costs' | 'vehicles' | 'drivers'
  | 'users' | 'reports' | 'settings' | 'audit';

export type NavItemDef = {
  key: NavKey;
  href: string;
  icon: IconName;
  group: 'workspace' | 'admin';
  /** Optional placeholder badge until backed by real counts in P1+ */
  staticBadge?: string;
};

export const NAV_ITEMS: NavItemDef[] = [
  { key: 'dashboard', href: '/',          icon: 'dashboard', group: 'workspace' },
  { key: 'trips',     href: '/trips',     icon: 'trips',     group: 'workspace', staticBadge: '12' },
  { key: 'costs',     href: '/costs',     icon: 'costs',     group: 'workspace', staticBadge: '4' },
  { key: 'vehicles',  href: '/vehicles',  icon: 'vehicles',  group: 'workspace' },
  { key: 'drivers',   href: '/drivers',   icon: 'drivers',   group: 'workspace' },
  { key: 'users',     href: '/users',     icon: 'users',     group: 'workspace' },
  { key: 'reports',   href: '/reports',   icon: 'reports',   group: 'workspace' },
  { key: 'settings',  href: '/settings',  icon: 'settings',  group: 'admin' },
  { key: 'audit',     href: '/audit',     icon: 'audit',     group: 'admin' },
];

/** Derive nav active key from pathname. Longest prefix wins. */
export function activeKeyFor(pathname: string): NavKey {
  let bestKey: NavKey = 'dashboard';
  let bestLen = 0;
  for (const item of NAV_ITEMS) {
    if (item.href === '/' && pathname === '/') return 'dashboard';
    if (item.href !== '/' && pathname.startsWith(item.href) && item.href.length > bestLen) {
      bestKey = item.key;
      bestLen = item.href.length;
    }
  }
  return bestKey;
}
