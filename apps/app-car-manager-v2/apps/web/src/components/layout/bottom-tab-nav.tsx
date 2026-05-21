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
 * means editing one file, not two. We take the first 4 workspace items since
 * the bar is a 4-column grid.
 *
 * Active state matches by `href`-prefix. `/` itself is just a redirect
 * (Module 3 dashboard removed) — STAFF lands at `/trips`, DRIVER at `/today`
 * — so the tab that lights up reflects the post-redirect URL, not `/`.
 *
 * Mobile tab inventory after Module 3 removal:
 *   - DRIVER: today · tripsMine · expensesNew · me  (4 / 4 grid slots)
 *   - STAFF:  trips · vehicles  · drivers     · me  (4 / 4 grid slots)
 *
 * Hidden on md+ where the sidebar takes over. */
export function BottomTabNav({ role }: BottomTabNavProps) {
  const pathname = usePathname() ?? '/';
  const tNav = useTranslations('nav');
  const tL   = useTranslations('layout');

  const items = navItemsForRole(role)
    .filter((item) => item.group === 'workspace')
    .slice(0, 4);

  return (
    <nav
      aria-label={tL('mobileNavAria')}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 h-14">
        {items.map((item) => {
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
