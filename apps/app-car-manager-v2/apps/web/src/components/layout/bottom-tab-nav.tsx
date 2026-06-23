'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { useActiveDept } from './dept-context';
import { navItemsForRole, type NavKey } from './nav-items';

interface BottomTabNavProps {
  role: LocalRole;
  /** Server-fed pending trips in the user's visibility scope. Drives the
   * red dot/numeric badge on the Trips tab. 0 hides the badge. */
  pendingTripCount: number;
  /** Server-fed expenses submitted today (Asia/Ho_Chi_Minh). Drives the
   * badge on the Chi phí tab (STAFF only — DRIVER doesn't have that tab). */
  todayExpenseCount: number;
}

/* Mobile-only navigation bar.
 *
 * Tabs derive from `navItemsForRole(role)` so the same canonical nav source
 * powers both the desktop sidebar and the mobile tab bar — adding a new route
 * means editing one file, not two.
 *
 * Layout per role:
 *   - DRIVER (4 workspace items): flat 4-column grid
 *     today · tripsMine · expensesNew · me
 *   - STAFF (5 workspace items): elevated `dashboard` button rising above the
 *     bar centre + 4 flat columns underneath
 *     [Dashboard ▦] over (trips · vehicles · drivers · me)
 *
 * The elevated layout solves the 5-into-4 squeeze for STAFF without
 * truncating long labels like "Bảng điều khiển" (~95px @ 12px font).
 * Dashboard becomes the visually dominant CTA which also matches its role
 * as the STAFF landing page.
 *
 * Active state matches by `href`-prefix. `/` itself is just a redirect —
 * STAFF lands at `/dashboard`, DRIVER at `/today` — so the tab/button that
 * lights up reflects the post-redirect URL, not `/`.
 *
 * Hidden on md+ where the sidebar takes over. */
export function BottomTabNav({ role, pendingTripCount, todayExpenseCount }: BottomTabNavProps) {
  const pathname = usePathname() ?? '/';
  const tNav = useTranslations('nav');
  const tL   = useTranslations('layout');
  /* Per-key badge counts. Keys absent or 0 → no badge. STAFF gets both
   * trips + costs; DRIVER's `tripsMine` would also benefit from a pending
   * count later but the current query is staff-scoped so we leave it. */
  const tabCounts: Partial<Record<NavKey, number>> = {
    trips: pendingTripCount,
    costs: todayExpenseCount,
  };

  const dept = useActiveDept();
  const workspace = navItemsForRole(role, { dept }).filter((item) => item.group === 'workspace');
  const dashboardItem = workspace.find((i) => i.key === 'dashboard');
  /* Flat row excludes both `dashboard` (rendered as the elevated centre
   * button) AND `me` (now a persistent avatar in the top-right of the
   * mobile header). STAFF flat = [trips, vehicles, drivers, costs];
   * DRIVER flat = [today, tripsMine, expensesNew]. We still cap at 4 so a
   * future workspace addition can't silently break the layout. */
  const flatItems = workspace
    .filter((i) => i.key !== 'dashboard' && i.key !== 'me')
    .slice(0, 4);
  /* Driver has no elevated centre, just 3 flat tabs — use grid-cols-3 so
   * each tab gets ~120px on a 360px viewport instead of a 25% slice with
   * an empty 4th cell. STAFF keeps the 5-column template with the centre
   * spacer reserved for the elevated Dashboard. */
  const tabCount = flatItems.length;

  return (
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
       * viewport. Without elevated Dashboard, use a plain grid sized to
       * `flatItems.length` (3 for DRIVER, 4 for any other no-dashboard role). */}
      <ul
        className={cn(
          'grid h-14',
          dashboardItem
            ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_72px_minmax(0,1fr)_minmax(0,1fr)]'
            : tabCount === 3
              ? 'grid-cols-3'
              : 'grid-cols-4',
        )}
      >
        {flatItems.slice(0, dashboardItem ? 2 : flatItems.length).map(renderFlatTab(pathname, tNav, tabCounts))}
        {dashboardItem && <li aria-hidden />}
        {dashboardItem && flatItems.slice(2).map(renderFlatTab(pathname, tNav, tabCounts))}
      </ul>
    </nav>
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
          <span className={cn('truncate px-1 leading-none', isActive && 'font-semibold')}>
            {tNav(navLabelKey(item.key))}
          </span>
        </Link>
      </li>
    );
  };
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

/** Helper type alias so `ElevatedDashboardTab`'s prop signature can borrow
 * the lucide icon type without importing it directly. */
type NavItem = ReturnType<typeof navItemsForRole>[number];

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
  return key;
}
