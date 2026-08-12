'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, ChevronRight, Menu, Truck } from 'lucide-react';
import {
  cn,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { useActiveDept } from './dept-context';
import {
  activeKeyFor,
  navItemsForRole,
  type FleetDept,
  type NavItem,
  type NavKey,
  type NavSection,
} from './nav-items';

/* Landing page per workspace — same targets the desktop DeptSwitch uses. */
const CAR_HOME = '/dashboard';
const TRUCK_HOME = '/truck/dashboard';

interface BottomTabNavProps {
  role: LocalRole;
  /** Departments this user may enter. Two of them means the workspace switch
   * belongs in the overflow sheet: the desktop switch lives in SidebarNav, which
   * sits inside `hidden md:contents`, so on a phone there was NO way at all to
   * cross from Car to Truck — and Manager/Director are the PWA personas. */
  fleetAccess: FleetDept[];
  /** Server-fed pending trips in the user's visibility scope. Drives the
   * red dot/numeric badge on the Trips tab. 0 hides the badge. */
  pendingTripCount: number;
  /** Server-fed expenses submitted today (Asia/Ho_Chi_Minh). Drives the
   * badge on the Chi phí tab (STAFF only — DRIVER doesn't have that tab). */
  todayExpenseCount: number;
  /** Server-fed truck reports created since the user last opened the list.
   * Drives the "Mới" badge on the truck Reports entry — which on mobile lives
   * inside the "Thêm" overflow sheet, so the More tab shows a dot when > 0. */
  newReportCount: number;
}

/* Mobile-only navigation bar.
 *
 * Tabs derive from `navItemsForRole(role)` so the same canonical nav source
 * powers both the desktop sidebar and the mobile tab bar — adding a new route
 * means editing one file, not two.
 *
 * Layout per role:
 *   - DRIVER (≤3 workspace items): flat grid sized to the item count
 *     today · tripsMine · expensesNew
 *   - CAR STAFF (5 workspace items): elevated `dashboard` button rising above
 *     the bar centre + 4 flat columns underneath
 *     [Dashboard ▦] over (trips · vehicles · drivers · costs)
 *   - TRUCK STAFF (7 workspace items): the bar can't hold them all, so it
 *     shows the first 4 + a "Thêm" tab that opens a bottom sheet listing the
 *     overflow (Chi phí & Lợi nhuận, Lập báo cáo, Danh sách báo cáo), grouped
 *     by the same Tài chính / Báo cáo sections as the desktop sidebar. Without
 *     this, those three menus would have NO bottom-nav entry at all (BUG: the
 *     old `.slice(0,4)` silently dropped them — there is no hamburger anywhere
 *     in the mobile chrome, so they were only reachable via dashboard links).
 *
 * The elevated layout solves the 5-into-4 squeeze for CAR STAFF without
 * truncating long labels like "Bảng điều khiển" (~95px @ 12px font).
 * Dashboard becomes the visually dominant CTA which also matches its role
 * as the CAR STAFF landing page.
 *
 * Active state matches by `href`-prefix. `/` itself is just a redirect —
 * STAFF lands at `/dashboard` (or `/truck/dashboard`), DRIVER at `/today` —
 * so the tab/button that lights up reflects the post-redirect URL, not `/`.
 *
 * Hidden on md+ where the sidebar takes over. */
export function BottomTabNav({
  role,
  fleetAccess,
  pendingTripCount,
  todayExpenseCount,
  newReportCount,
}: BottomTabNavProps) {
  const pathname = usePathname() ?? '/';
  const tNav = useTranslations('nav');
  const tL   = useTranslations('layout');
  const [moreOpen, setMoreOpen] = useState(false);
  /* Per-key badge counts. Keys absent or 0 → no badge. `truckReports` lives in
   * the overflow sheet, so its count surfaces as a dot on the "Thêm" tab. */
  const tabCounts: Partial<Record<NavKey, number>> = {
    trips: pendingTripCount,
    costs: todayExpenseCount,
    truckReports: newReportCount,
  };

  const dept = useActiveDept();
  const workspace = navItemsForRole(role, { dept }).filter((item) => item.group === 'workspace');
  /* Dashboard — car `dashboard` OR truck `truckDashboard` — renders as the
   * elevated centre button (icon-only), so its long label "Bảng điều khiển"
   * never has to squeeze into a flat tab slot. */
  const dashboardItem = workspace.find((i) => i.key === 'dashboard' || i.key === 'truckDashboard');
  /* Flat-row candidates exclude the elevated dashboard AND `me` (a persistent
   * avatar in the top-right of the mobile header). */
  const flatCandidates = workspace.filter((i) => i.key !== dashboardItem?.key && i.key !== 'me');

  /* The elevated layout reserves a centre column → 4 flat slots (2 + 2); the
   * flat-only layout (driver) holds up to 5. When candidates exceed the slots,
   * show (slots − 1) primary tabs + a "Thêm" tab opening a bottom sheet with
   * the rest. Truck STAFF (6 candidates) → elevated Dashboard + trips/fleet/
   * drivers + Thêm(finance/reports), matching car's IA and avoiding the 5-flat
   * label squeeze. */
  const MAX_FLAT = dashboardItem ? 4 : 5;
  /* Same honest condition as DeptSwitch: "may enter both workspaces". A
   * single-department manager or a driver never matches, so their bar is
   * untouched. */
  const canSwitchDept = fleetAccess.includes('CAR') && fleetAccess.includes('TRUCK');
  /* The sheet is also the only mobile home for the workspace switch, so a
   * two-department user gets a "Thêm" tab even when nothing overflows — the tab
   * then costs one flat slot, which is why the slicing keys off this and not off
   * overflow alone. (In practice STAFF in either workspace already overflows: 5
   * car candidates / 6 truck candidates against 4 slots.) */
  const hasOverflow = flatCandidates.length > MAX_FLAT;
  const showMore = hasOverflow || canSwitchDept;
  const flatItems = showMore
    ? flatCandidates.slice(0, MAX_FLAT - 1)
    : flatCandidates.slice(0, MAX_FLAT);
  const overflowItems = showMore ? flatCandidates.slice(MAX_FLAT - 1) : [];

  /* Canonical active key (handles /truck/pnl → truckFinance, /truck/import →
   * truckTrips, etc). Used to light the "Thêm" tab + highlight the sheet row
   * when the current route lives behind the overflow. */
  const activeKey = activeKeyFor(pathname, role);
  const moreActive = overflowItems.some((i) => i.key === activeKey);
  const moreHasBadge = overflowItems.some((i) => (tabCounts[i.key] ?? 0) > 0);

  /* Number of flat cells in the non-elevated layout (primary tabs + the
   * optional "Thêm" tab). Mapped to a static Tailwind class so JIT keeps it. */
  const flatCellCount = flatItems.length + (showMore ? 1 : 0);
  const FLAT_GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  };

  return (
    <>
      <nav
        aria-label={tL('mobileNavAria')}
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
      >
        {dashboardItem && (
          <ElevatedDashboardTab
            item={dashboardItem}
            isActive={matchesTab(pathname, dashboardItem.href, dashboardItem.key)}
            label={tNav(navLabelKey(dashboardItem.key))}
          />
        )}
        {/* When the elevated Dashboard is present we carve out a fixed-width
         * centre column (72px) so the round button (56px) gets ~8px of clear
         * space on each side. `minmax(0,1fr)` on side cells lets labels
         * truncate gracefully instead of forcing the grid wider than the
         * viewport. Without elevated Dashboard, use a plain grid sized to the
         * flat-cell count (incl. the "Thêm" tab when present). */}
        <ul
          className={cn(
            'grid h-14',
            dashboardItem
              ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px_minmax(0,1fr)_minmax(0,1fr)]'
              : FLAT_GRID[flatCellCount] ?? 'grid-cols-4',
          )}
        >
          {dashboardItem ? (
            <>
              {flatItems.slice(0, 2).map(renderFlatTab(pathname, tNav, tabCounts))}
              <li aria-hidden />
              {flatItems.slice(2).map(renderFlatTab(pathname, tNav, tabCounts))}
              {showMore && (
                <MoreTab
                  label={tNav('more')}
                  ariaLabel={tNav('moreAria')}
                  isActive={moreActive}
                  hasBadge={moreHasBadge}
                  onClick={() => setMoreOpen(true)}
                />
              )}
            </>
          ) : (
            <>
              {flatItems.map(renderFlatTab(pathname, tNav, tabCounts))}
              {showMore && (
                <MoreTab
                  label={tNav('more')}
                  ariaLabel={tNav('moreAria')}
                  isActive={moreActive}
                  hasBadge={moreHasBadge}
                  onClick={() => setMoreOpen(true)}
                />
              )}
            </>
          )}
        </ul>
      </nav>

      {showMore && (
        <OverflowSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          items={overflowItems}
          activeKey={activeKey}
          tabCounts={tabCounts}
          canSwitchDept={canSwitchDept}
          dept={dept}
        />
      )}
    </>
  );
}

/** Closure-returning render helper so the two `flatItems.slice(...)` arms
 * stay terse without duplicating the tab JSX. Pulled out of the inline
 * `.map` so the JSX above reads as layout rather than rendering detail. */
function renderFlatTab(
  pathname: string,
  tNav: (key: string) => string,
  tabCounts: Partial<Record<NavKey, number>>,
) {
  return function FlatTab(item: ReturnType<typeof navItemsForRole>[number]) {
    const isActive = matchesTab(pathname, item.href, item.key);
    const count = tabCounts[item.key] ?? 0;
    return (
      <li key={item.key} className="relative">
        {/* Active indicator — top accent bar */}
        <span
          aria-hidden
          className={cn(
            'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-180 motion-reduce:transition-none',
            isActive ? 'w-10 bg-accent' : 'w-0 bg-transparent',
          )}
        />
        <Link
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            'active:bg-surface-2/60 transition-colors duration-150 motion-reduce:transition-none',
            isActive ? 'text-accent' : 'text-text-muted',
          )}
        >
          {/* Icon with optional count badge in the top-right corner. The
           * badge is a small pill (9px tall, ~14px min width) sitting just
           * off the icon's upper-right — far enough from the tab label
           * underneath that it doesn't crowd, close enough to the icon
           * that it reads as "X new on this tab". Caps at "9+" to keep
           * the pill from blowing up the icon's own footprint. */}
          <span className="relative inline-flex">
            <item.Icon
              className={cn('h-6 w-6 transition-transform duration-180', isActive && 'scale-[1.05]')}
              strokeWidth={isActive ? 2.4 : 1.8}
              aria-hidden
            />
            {count > 0 && (
              <span
                className={cn(
                  'absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full',
                  'inline-flex items-center justify-center text-[9px] font-bold tabular leading-none',
                  'bg-danger text-danger-fg ring-2 ring-surface',
                )}
                aria-label={`${count}`}
              >
                {count > 9 ? '9+' : count}
              </span>
            )}
          </span>
          <span className={cn('w-full truncate px-1 text-center leading-none', isActive && 'font-semibold')}>
            {tNav(navLabelKey(item.key))}
          </span>
        </Link>
      </li>
    );
  };
}

/* "Thêm" tab — opens the overflow sheet. Styled to match a flat tab (icon +
 * label) so it reads as a peer of the real destinations. Shows a small dot
 * when something behind it has a badge (e.g. new truck reports). */
function MoreTab({
  label,
  ariaLabel,
  isActive,
  hasBadge,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  isActive: boolean;
  hasBadge: boolean;
  onClick: () => void;
}) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-180 motion-reduce:transition-none',
          isActive ? 'w-10 bg-accent' : 'w-0 bg-transparent',
        )}
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        className={cn(
          'h-full w-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          'active:bg-surface-2/60 transition-colors duration-150 motion-reduce:transition-none',
          isActive ? 'text-accent' : 'text-text-muted',
        )}
      >
        <span className="relative inline-flex">
          <Menu
            className={cn('h-6 w-6 transition-transform duration-180', isActive && 'scale-[1.05]')}
            strokeWidth={isActive ? 2.4 : 1.8}
            aria-hidden
          />
          {hasBadge && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface"
            />
          )}
        </span>
        <span className={cn('w-full truncate px-1 text-center leading-none', isActive && 'font-semibold')}>{label}</span>
      </button>
    </li>
  );
}

/* Bottom sheet listing the workspace destinations that don't fit in the bar.
 * Grouped by the same sections as the desktop sidebar (Tài chính / Báo cáo)
 * so the IA is consistent across breakpoints. Rows are 48px tall for a
 * comfortable thumb target and close the sheet on navigation. */
function OverflowSheet({
  open,
  onOpenChange,
  items,
  activeKey,
  tabCounts,
  canSwitchDept,
  dept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  activeKey: NavKey;
  tabCounts: Partial<Record<NavKey, number>>;
  /** User holds both departments → offer the Car ⇄ Truck switch. */
  canSwitchDept: boolean;
  dept: FleetDept;
}) {
  const tNav = useTranslations('nav');
  const tL = useTranslations('layout');
  const tDept = useTranslations('layout.dept');
  const tRoot = useTranslations();
  const tSections = useTranslations('navSections');

  /* Preserve nav order while grouping by section. */
  const groups: { section: NavSection | null; items: NavItem[] }[] = [];
  for (const item of items) {
    const section = item.section ?? null;
    let g = groups.find((x) => x.section === section);
    if (!g) {
      g = { section, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="md:hidden p-0 pb-[env(safe-area-inset-bottom)] max-h-[80dvh] overflow-y-auto"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle>{tL('moreSheet.title')}</SheetTitle>
          <SheetDescription className="sr-only">{tL('moreSheet.description')}</SheetDescription>
        </SheetHeader>
        <div className="px-2 pb-3">
          {/* Workspace switch — first, because it re-scopes everything below it.
            * Two links rather than a toggle so each is a real 48px thumb target
            * and lands on the same home the desktop switch uses. */}
          {canSwitchDept && (
            <div className="mb-1">
              <div className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                {tRoot('workspace')}
              </div>
              <ul>
                {([
                  { key: 'CAR', href: CAR_HOME, Icon: Car, label: tDept('car') },
                  { key: 'TRUCK', href: TRUCK_HOME, Icon: Truck, label: tDept('truck') },
                ] as const).map((d) => {
                  const isActive = dept === d.key;
                  return (
                    <li key={d.key}>
                      <Link
                        href={d.href}
                        onClick={() => onOpenChange(false)}
                        aria-current={isActive ? 'true' : undefined}
                        className={cn(
                          'flex items-center gap-3 h-12 rounded-lg px-3 text-[15px] font-medium',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'transition-colors duration-150 motion-reduce:transition-none',
                          isActive
                            ? 'bg-accent text-accent-fg'
                            : 'text-text hover:bg-surface-2 active:bg-surface-2/80',
                        )}
                      >
                        <d.Icon className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="flex-1 truncate">{d.label}</span>
                        <ChevronRight
                          className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent-fg/70' : 'text-text-faint')}
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {groups.map((group, gi) => (
            <div key={group.section ?? `g${gi}`} className="mb-1">
              {group.section && (
                <div className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                  {tSections(group.section)}
                </div>
              )}
              <ul>
                {group.items.map((item) => {
                  const isActive = item.key === activeKey;
                  const count = tabCounts[item.key] ?? 0;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 h-12 rounded-lg px-3 text-[15px] font-medium',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'transition-colors duration-150 motion-reduce:transition-none',
                          isActive
                            ? 'bg-accent text-accent-fg'
                            : 'text-text hover:bg-surface-2 active:bg-surface-2/80',
                        )}
                      >
                        <item.Icon className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="flex-1 truncate">{tNav(navLabelKey(item.key))}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              'min-w-[20px] h-5 px-1.5 rounded-full inline-flex items-center justify-center',
                              'text-[11px] font-bold tabular leading-none',
                              isActive ? 'bg-accent-fg/15 text-accent-fg' : 'bg-info-soft text-info',
                            )}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                        <ChevronRight
                          className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent-fg/70' : 'text-text-faint')}
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* Elevated centre button for the STAFF Dashboard. Positioned absolutely so it
 * sits above the bar (≈22px protrusion) with shadow for elevation. Icon-only
 * — the label "Bảng điều khiển" is too long to fit a single tab slot, so we
 * trade the visible label for a screen-reader-accessible aria-label.
 *
 * Doesn't collide with the existing right-side Fab (create-trip) because
 * that one anchors to `right-4` while this one anchors to the centre. */
function ElevatedDashboardTab({
  item,
  isActive,
  label,
}: {
  item: { href: string; Icon: NavItem['Icon'] };
  isActive: boolean;
  label: string;
}) {
  return (
    <Link
      href={item.href}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -top-5 z-50',
        'inline-flex items-center justify-center',
        'h-14 w-14 rounded-full shadow-lg',
        'bg-accent text-accent-fg',
        'transition-transform duration-150 motion-reduce:transition-none',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        /* When dashboard is the current page, a faint accent halo behind the
         * button gives the same visual confirmation as the top-bar indicator
         * on flat tabs. Subtle — full-opacity would compete with the shadow. */
        isActive && 'ring-4 ring-accent/30',
      )}
    >
      <item.Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
    </Link>
  );
}

/* Match the pathname to a tab.
 *
 * Special cases:
 *   - `tripsMine` and `trips` both point to `/trips` — they don't both render
 *     in a single user's nav (role filters one out), so a single startsWith
 *     check is enough.
 *   - `expensesNew` covers `/expenses` + `/expenses/new` so the tab stays lit
 *     across the submit flow.
 *   - `me` covers `/settings/me` subroutes (preferences, locale).
 *   - Root `/` is briefly visible before the page-level redirect fires.
 *     `today` lights up for DRIVER, `trips` for STAFF — driven by which
 *     tab is in `items` (role filter already restricts it). */
function matchesTab(pathname: string, href: string, key: NavKey): boolean {
  if (pathname === href) return true;
  /* `/expenses` subroutes all live under `expensesNew`'s `/expenses/new` —
   * widen the match so the tab stays lit on subsequent flows. */
  if (key === 'expensesNew' && pathname.startsWith('/expenses')) return true;
  if (key === 'me' && pathname.startsWith('/settings/me')) return true;
  if (key === 'today' && pathname === '/') return true;
  if (key === 'trips' && pathname === '/') return true;
  return pathname.startsWith(href + '/') || pathname === href;
}

/* Some nav keys differ from their i18n label key (specifically `audit` reads
 * as `auditLog` in the messages bundle for legibility). All others map 1:1. */
function navLabelKey(key: NavKey): string {
  if (key === 'audit') return 'auditLog';
  /* Truck STAFF flat tabs use concise bottom-nav labels so they fit the ~76px
   * cell without ellipsis; the desktop sidebar keeps the full descriptive
   * labels (truckTrips = "Nhật ký chuyến", etc). */
  if (key === 'truckTrips') return 'truckTripsShort';
  if (key === 'truckFleet') return 'truckFleetShort';
  if (key === 'truckDrivers') return 'truckDriversShort';
  return key;
}
