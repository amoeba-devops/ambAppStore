'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { navItemsForRole, type NavKey } from './nav-items';

interface BottomTabNavProps {
  role: LocalRole;
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
export function BottomTabNav({ role }: BottomTabNavProps) {
  const pathname = usePathname() ?? '/';
  const tNav = useTranslations('nav');
  const tL   = useTranslations('layout');

  const workspace = navItemsForRole(role).filter((item) => item.group === 'workspace');
  const dashboardItem = workspace.find((i) => i.key === 'dashboard');
  /* Flat row: everything except the elevated dashboard. We cap at 4 so a
   * future workspace addition won't silently bleed into a 5-column row. */
  const flatItems = workspace.filter((i) => i.key !== 'dashboard').slice(0, 4);

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
      <ul className="grid grid-cols-4 h-14">
        {flatItems.map((item) => {
          const isActive = matchesTab(pathname, item.href, item.key);
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
                <item.Icon
                  className={cn('h-6 w-6 transition-transform duration-180', isActive && 'scale-[1.05]')}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  aria-hidden
                />
                <span className={cn('leading-none', isActive && 'font-semibold')}>
                  {tNav(navLabelKey(item.key))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
