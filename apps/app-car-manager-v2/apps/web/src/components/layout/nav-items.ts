import {
  CalendarClock,
  ClipboardList,
  Car,
  Coins,
  FilePlus,
  FileText,
  IdCard,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
  Truck,
  UserCog,
  Wrench,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import type { LocalRole } from '@car-v2/shared/auth';

/** Fleet department context (REQ-20260617). Mirrors car_vehicles.cvh_type. */
export type FleetDept = 'CAR' | 'TRUCK';

export type NavKey =
  | 'today'
  | 'dashboard'
  | 'trips'
  | 'tripsMine'
  | 'expensesNew'
  | 'costs'
  | 'vehicles'
  | 'drivers'
  | 'maintenance'
  | 'users'
  | 'settings'
  | 'fleetAccess'
  | 'truckDashboard'
  | 'truckTrips'
  | 'truckFleet'
  | 'truckFinance'
  | 'truckDrivers'
  | 'truckReportCreate'
  | 'truckReports'
  | 'truckSettings'
  | 'me'
  | 'audit';

/** Sub-section within the workspace group. Truck workspace nav is organized
 * into these labeled sections to match the design IA (Vận hành / Tài chính /
 * Dữ liệu / Báo cáo). Car workspace items omit `section` → single group. */
export type NavSection = 'operations' | 'finance' | 'data' | 'reports';

export interface NavItem {
  key: NavKey;
  href: string;
  Icon: LucideIcon;
  group: 'workspace' | 'admin';
  /** Optional sub-section heading within the workspace group (truck IA). */
  section?: NavSection;
  /** Roles allowed to see this nav item. */
  roles: readonly LocalRole[];
  /** When set, the item only appears in this fleet department context.
   * Items without `fleet` are department-agnostic (show in any context). */
  fleet?: FleetDept;
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
  { key: 'dashboard',   href: '/dashboard',     Icon: LayoutDashboard, group: 'workspace', roles: STAFF, fleet: 'CAR'  },
  /* Admin/Manager trips overview = full fleet — list/table view for drill-down. */
  { key: 'trips',       href: '/trips',         Icon: ClipboardList,   group: 'workspace', roles: STAFF, fleet: 'CAR'  },
  /* Driver expense home — list of their submissions. The submit form lives at
   * `/expenses/new` and is reached via the page's "+ New" button. */
  /* Car driver only — truck drivers record costs inside the trip completion
   * form, so this tab is fleet:'CAR' (hidden for a truck driver → 3 tabs). */
  { key: 'expensesNew', href: '/expenses',      Icon: Receipt,         group: 'workspace', roles: DRIVER, fleet: 'CAR' },
  { key: 'vehicles',    href: '/vehicles',      Icon: Car,             group: 'workspace', roles: STAFF, fleet: 'CAR'  },
  /* ── Truck workspace (fleet='TRUCK', shown only in the truck dept context).
   *    Organized into 4 sections matching the design IA (REQ-20260629):
   *    Vận hành · Tài chính · Dữ liệu · Báo cáo. Order within = display order. ── */
  /* Vận hành */
  { key: 'truckDashboard', href: '/truck/dashboard', Icon: LayoutDashboard, group: 'workspace', section: 'operations', roles: STAFF, fleet: 'TRUCK' },
  { key: 'truckTrips',  href: '/truck/trips',   Icon: ClipboardList,   group: 'workspace', section: 'operations', roles: STAFF, fleet: 'TRUCK' },
  { key: 'truckFleet',  href: '/truck/fleet',   Icon: Truck,           group: 'workspace', section: 'operations', roles: STAFF, fleet: 'TRUCK' },
  { key: 'truckDrivers', href: '/truck/drivers', Icon: IdCard,         group: 'workspace', section: 'operations', roles: STAFF, fleet: 'TRUCK' },
  /* Tài chính — single menu (design wires only "Chi phí và Lợi nhuận"). The
   * P&L overview + month close live under /truck/pnl as tabs of this same menu
   * (shared FinanceTabs), so there's no separate nav item. */
  { key: 'truckFinance', href: '/truck/finance', Icon: Coins,          group: 'workspace', section: 'finance', roles: STAFF, fleet: 'TRUCK' },
  /* Import Excel has NO sidebar menu (design IA) — reached from the trip-log
   * header button. The /truck/import route + wizard stay. */
  /* Báo cáo (REQ-20260629 R8): lập báo cáo + danh sách lưu trữ (badge "Mới"). */
  { key: 'truckReportCreate', href: '/truck/reports/new', Icon: FilePlus, group: 'workspace', section: 'reports', roles: STAFF, fleet: 'TRUCK' },
  { key: 'truckReports', href: '/truck/reports', Icon: FileText,       group: 'workspace', section: 'reports', roles: STAFF, fleet: 'TRUCK' },
  /* truckSettings folded into truckPnl — REQ-20260623 G4. */
  /* Car drivers roster (CCMS). Tagged CAR so the truck workspace shows its own
   * `truckDrivers` instead (department separation). */
  { key: 'drivers',     href: '/drivers',       Icon: IdCard,          group: 'workspace', roles: STAFF, fleet: 'CAR'   },
  /* Profile / locale / logout — universal. Sidebar pulls this out into its
   * own tail block; mobile keeps it as the rightmost flat tab. Positioned
   * BEFORE `costs` so the mobile `slice(0, 4)` retains `me` and drops
   * `costs` instead — staff reach `/costs` via the sidebar on desktop and
   * via the dashboard widget on mobile. */
  { key: 'me',          href: '/settings/me',   Icon: UserIcon,        group: 'workspace', roles: ALL    },
  /* Operating-cost ledger (Module 2). STAFF only — drivers see their own
   * history at `/expenses` via `expensesNew` instead. */
  { key: 'costs',       href: '/costs',         Icon: Receipt,         group: 'workspace', roles: STAFF, fleet: 'CAR'  },
  /* Cảnh báo bảo dưỡng (Module 2, REQ-20260519). CAR-scoped — the evaluator
   * scans cars only and each alert deep-links to /vehicles/:id.
   *
   * Deliberately LAST among the car workspace items: this is the 6th, which
   * tips BottomTabNav's CAR STAFF layout past its 4 flat slots into the "Thêm"
   * overflow sheet. Ordering it here means the sheet swallows `costs` +
   * `maintenance` (the two least-frequent) instead of displacing `drivers`. */
  { key: 'maintenance', href: '/maintenance',   Icon: Wrench,          group: 'workspace', roles: STAFF, fleet: 'CAR'  },
  /* Admin-only tenant tools. */
  { key: 'users',       href: '/users',         Icon: UserCog,         group: 'admin',     roles: ADMIN  },
  /* Fleet department access — grant/revoke CAR/TRUCK + approve manager requests.
   * TẠM ẨN khỏi menu (QA feedback 2026-07): trang + route vẫn hoạt động, truy cập
   * trực tiếp qua /settings/fleet-access. Bỏ comment để hiện lại. */
  // { key: 'fleetAccess', href: '/settings/fleet-access', Icon: KeyRound, group: 'admin',     roles: ADMIN  },
  { key: 'audit',       href: '/audit',         Icon: ScrollText,      group: 'admin',     roles: ADMIN  },
  /* Cài đặt luôn nằm cuối danh sách (QA feedback 2026-07). */
  { key: 'settings',    href: '/settings',      Icon: SettingsIcon,    group: 'admin',     roles: ADMIN  },
];

/**
 * Items visible to a role, optionally filtered by the active fleet department.
 * Backward-compatible: callers that omit `opts.dept` get no department
 * filtering, so department-scoped items still appear (used until truck screens
 * land). Pass `dept` to hide items belonging to the other department.
 */
export function navItemsForRole(role: LocalRole, opts?: { dept?: FleetDept }): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.fleet && opts?.dept && item.fleet !== opts.dept) return false;
    return true;
  });
}

/** Active fleet department derived from the URL: truck workspace lives under
 * `/truck/*`, everything else is the car workspace. */
export function deptForPath(pathname: string): FleetDept {
  return pathname.startsWith('/truck') ? 'TRUCK' : 'CAR';
}

/* Car-workspace URL roots. These pages belong unambiguously to the CAR
 * department, so landing on one switches the active workspace to CAR. Every
 * other non-`/truck` path (drivers/users/settings/audit/fleet-access/profile)
 * is department-NEUTRAL: it must NOT change the active workspace, otherwise the
 * sidebar "jumps" back to car the moment a truck-workspace user opens a shared
 * admin page (BUG-20260622). */
const CAR_PREFIXES = ['/dashboard', '/trips', '/vehicles', '/costs', '/expenses', '/maintenance'] as const;

/**
 * The department a path UNAMBIGUOUSLY belongs to, or `null` when the path is
 * department-neutral (shared across both workspaces). Used by the sticky
 * workspace resolver: a clear dept updates + persists the active workspace; a
 * neutral path keeps whatever workspace the user was already in.
 */
export function clearlyDept(pathname: string): FleetDept | null {
  if (pathname.startsWith('/truck')) return 'TRUCK';
  if (CAR_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return 'CAR';
  return null;
}

/* Pick the active nav key for a given pathname; longest prefix wins. Falls
 * back per-role default landing — drivers go to 'today', staff to 'dashboard'.
 * Both roles use `/` as splash but are immediately redirected by RootRedirect. */
export function activeKeyFor(pathname: string, role?: LocalRole): NavKey {
  const fallback: NavKey = role === 'DRIVER' ? 'today' : 'dashboard';
  if (pathname === '/') return fallback;
  /* P&L overview + month close are tabs of the "Chi phí và Lợi nhuận" menu
   * (truckFinance) but live under /truck/pnl — keep that menu highlighted. */
  if (pathname.startsWith('/truck/pnl')) return 'truckFinance';
  /* Import has no sidebar menu — it's a sub-flow of the trip log; keep Trips lit. */
  if (pathname.startsWith('/truck/import')) return 'truckTrips';
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
