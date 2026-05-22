import {
  CalendarClock,
  ClipboardList,
  Car,
  IdCard,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  UserCog,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import type { LocalRole } from '@car-v2/shared/auth';

export type NavKey =
  | 'today'
  | 'dashboard'
  | 'trips'
  | 'tripsMine'
  | 'expensesNew'
  | 'vehicles'
  | 'drivers'
  | 'users'
  | 'settings'
  | 'me'
  | 'audit';

export interface NavItem {
  key: NavKey;
  href: string;
  Icon: LucideIcon;
  group: 'workspace' | 'admin';
  /** Roles allowed to see this nav item. */
  roles: readonly LocalRole[];
  staticBadge?: string;
}

const STAFF: readonly LocalRole[]  = ['ADMIN', 'MANAGER'] as const;
const ADMIN: readonly LocalRole[]  = ['ADMIN'] as const;
const DRIVER: readonly LocalRole[] = ['DRIVER'] as const;
const ALL: readonly LocalRole[]    = ['ADMIN', 'MANAGER', 'DRIVER'] as const;

/* Nav inventory.
 *
 * Schedule Dashboard (REQ-20260522) reintroduced a calendar-centric hub at
 * `/dashboard` — STAFF lands there (set in app/(app)/page.tsx). The natural
 * admin flow is now: Dashboard → Trips → Vehicles → Drivers → Profile.
 *
 * Items are filtered per role via `roles`. The same items drive both the
 * desktop sidebar and the mobile BottomTabNav so the navigation surface stays
 * coherent across breakpoints.
 *
 * Role-specific entries:
 *   - `trips`/`vehicles`/`drivers` are Admin/Manager workflows.
 *   - `today`, `tripsMine`, `expensesNew`, `me` are the four Driver
 *     destinations.
 *   - `tripsMine` and `trips` both link to `/trips` but use distinct labels
 *     ("Chuyến của tôi" vs "Chuyến đi") for ownership clarity. The page
 *     itself branches the rendering by role.
 *
 * BottomTabNav slices the first 4 items returned by `navItemsForRole` because
 * the bar is a 4-column grid. Order in this array therefore IS the tab order:
 *   - DRIVER mobile tabs: today · tripsMine · expensesNew · me
 *   - STAFF mobile tabs:  trips · vehicles  · drivers     · me */
export const NAV_ITEMS: NavItem[] = [
  /* Driver landing — "Today" with assigned trips + state-aware CTA. */
  { key: 'today',       href: '/today',         Icon: CalendarClock,   group: 'workspace', roles: DRIVER },
  /* Driver's trips list = filtered to "mine". Different label than admin trips. */
  { key: 'tripsMine',   href: '/trips',         Icon: ClipboardList,   group: 'workspace', roles: DRIVER },
  /* STAFF landing — Schedule Dashboard (calendar + booking + vehicle legend). */
  { key: 'dashboard',   href: '/dashboard',     Icon: LayoutDashboard, group: 'workspace', roles: STAFF  },
  /* Admin/Manager trips overview = full fleet — list/table view for drill-down. */
  { key: 'trips',       href: '/trips',         Icon: ClipboardList,   group: 'workspace', roles: STAFF  },
  /* Driver expense home — list of their submissions. The submit form lives at
   * `/expenses/new` and is reached via the page's "+ New" button. */
  { key: 'expensesNew', href: '/expenses',      Icon: Receipt,         group: 'workspace', roles: DRIVER },
  { key: 'vehicles',    href: '/vehicles',      Icon: Car,             group: 'workspace', roles: STAFF  },
  { key: 'drivers',     href: '/drivers',       Icon: IdCard,          group: 'workspace', roles: STAFF  },
  /* Profile / locale / logout — universal. Last workspace slot on mobile. */
  { key: 'me',          href: '/settings/me',   Icon: UserIcon,        group: 'workspace', roles: ALL    },
  /* Admin-only tenant tools. */
  { key: 'users',       href: '/users',         Icon: UserCog,         group: 'admin',     roles: ADMIN  },
  { key: 'settings',    href: '/settings',      Icon: SettingsIcon,    group: 'admin',     roles: ADMIN  },
  { key: 'audit',       href: '/audit',         Icon: ScrollText,      group: 'admin',     roles: ADMIN  },
];

export function navItemsForRole(role: LocalRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/* Pick the active nav key for a given pathname; longest prefix wins. Falls
 * back per-role default landing — drivers go to 'today', staff to 'dashboard'.
 * Both roles use `/` as splash but are immediately redirected by RootRedirect. */
export function activeKeyFor(pathname: string, role?: LocalRole): NavKey {
  const fallback: NavKey = role === 'DRIVER' ? 'today' : 'dashboard';
  if (pathname === '/') return fallback;
  let bestKey: NavKey = fallback;
  let bestLen = 0;
  for (const item of NAV_ITEMS) {
    if (item.href === '/') continue;
    if (pathname.startsWith(item.href) && item.href.length > bestLen) {
      bestKey = item.key;
      bestLen = item.href.length;
    }
  }
  return bestKey;
}
