import type { LocalRole } from '@car-v2/shared/auth';

/**
 * Map (pathname × role × locale) → user-guide HTML page.
 *
 * Guide tree lives at `apps/web/public/docs/user-guide/{locale}/{role}/{file}.html`.
 * Only `vi/` and `ko/` are authored — English UI falls back to Vietnamese
 * (mirrors the existing locale-switcher behaviour).
 *
 * Resolution order:
 *   1. Most-specific prefix match on `pathname` for the given role
 *   2. Role overview (e.g. `admin/00-tong-quan.html`) when nothing matches
 *   3. Site index when role has no overview page (defensive)
 */

export type GuideLocale = 'vi' | 'ko';

export function resolveGuideLocale(uiLocale: string): GuideLocale {
  return uiLocale === 'ko' ? 'ko' : 'vi'; // en + anything else → vi
}

interface PathRule {
  /** Match if pathname `=== exact` or `startsWith(prefix + '/')` */
  prefix: string;
  /** Map of role → guide file (relative to `{locale}/`). `undefined` = use role overview. */
  byRole: Partial<Record<LocalRole, string>>;
}

/**
 * Ordered most-specific → least-specific. First prefix that matches wins.
 * Each rule maps a route to the guide file PER ROLE — same route can land
 * different roles on different pages (e.g. `/trips` → admin sees trip
 * management page, driver sees today-screen flow).
 */
const PATH_RULES: PathRule[] = [
  // /settings/me — same overview for everyone
  {
    prefix: '/settings/me',
    byRole: {
      ADMIN: 'admin/00-tong-quan.html',
      MANAGER: 'manager/00-tong-quan.html',
      DRIVER: 'driver/00-tong-quan.html',
    },
  },
  // /settings (admin only)
  {
    prefix: '/settings',
    byRole: { ADMIN: 'admin/09-cau-hinh-he-thong.html' },
  },
  // /inbox — notifications guide is common; per-role docs not split yet
  {
    prefix: '/inbox',
    byRole: {
      ADMIN: 'admin/00-tong-quan.html',
      MANAGER: 'manager/00-tong-quan.html',
      DRIVER: 'driver/02-today-screen.html',
    },
  },
  // /today — driver-only daily screen
  {
    prefix: '/today',
    byRole: { DRIVER: 'driver/02-today-screen.html' },
  },
  // /dashboard — admin/manager schedule view
  {
    prefix: '/dashboard',
    byRole: {
      ADMIN: 'admin/01-dashboard.html',
      MANAGER: 'manager/01-dashboard.html',
    },
  },
  // /trips/[id]/edit — admin trip edit doc
  {
    prefix: '/trips',
    byRole: {
      ADMIN: 'admin/05-quan-ly-chuyen-di.html',
      MANAGER: 'manager/03-theo-doi-chuyen-di.html',
      DRIVER: 'driver/03-xac-nhan-chuyen.html',
    },
  },
  // /vehicles
  {
    prefix: '/vehicles',
    byRole: {
      ADMIN: 'admin/02-quan-ly-xe.html',
      MANAGER: 'admin/02-quan-ly-xe.html', // manager sees same doc, read-only flow
    },
  },
  // /drivers — admin only management
  {
    prefix: '/drivers',
    byRole: { ADMIN: 'admin/03-quan-ly-tai-xe.html' },
  },
  // /users — admin only
  {
    prefix: '/users',
    byRole: { ADMIN: 'admin/04-quan-ly-nguoi-dung.html' },
  },
  // /costs — admin/manager fleet expense ledger
  {
    prefix: '/costs',
    byRole: {
      ADMIN: 'admin/06-quan-ly-chi-phi.html',
      MANAGER: 'manager/05-so-chi-phi.html',
    },
  },
  // /expenses — driver own-expense history + submission
  {
    prefix: '/expenses',
    byRole: {
      ADMIN: 'admin/06-quan-ly-chi-phi.html',
      MANAGER: 'manager/04-ghi-chi-phi.html',
      DRIVER: 'driver/05-ghi-chi-phi.html',
    },
  },
  // /maintenance (admin only)
  {
    prefix: '/maintenance',
    byRole: { ADMIN: 'admin/07-canh-bao-bao-duong.html' },
  },
  // /reports
  {
    prefix: '/reports',
    byRole: {
      ADMIN: 'admin/08-bao-cao.html',
      MANAGER: 'manager/06-bao-cao-ca-nhan.html',
    },
  },
  // /audit — admin only
  {
    prefix: '/audit',
    byRole: { ADMIN: 'admin/10-audit-log.html' },
  },
];

const ROLE_OVERVIEW: Record<LocalRole, string> = {
  ADMIN: 'admin/00-tong-quan.html',
  MANAGER: 'manager/00-tong-quan.html',
  DRIVER: 'driver/00-tong-quan.html',
};

export interface ResolvedGuide {
  /** Absolute URL into `public/docs/user-guide/...` (no origin, no basePath). */
  src: string;
  /** Whether a specific page matched. False = role overview fallback. */
  matched: boolean;
  /** Locale actually used (post EN→VI fallback). */
  locale: GuideLocale;
  /** Page file (relative to locale dir) — useful for analytics + debug. */
  page: string;
}

function matchPath(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function resolveGuidePage(
  pathname: string,
  role: LocalRole,
  uiLocale: string,
  basePath = '',
): ResolvedGuide {
  const locale = resolveGuideLocale(uiLocale);

  for (const rule of PATH_RULES) {
    if (!matchPath(pathname, rule.prefix)) continue;
    const page = rule.byRole[role];
    if (page) {
      return {
        src: `${basePath}/docs/user-guide/${locale}/${page}`,
        matched: true,
        locale,
        page,
      };
    }
  }

  // No prefix matched (or role not represented for this prefix) → role overview
  const overview = ROLE_OVERVIEW[role];
  return {
    src: `${basePath}/docs/user-guide/${locale}/${overview}`,
    matched: false,
    locale,
    page: overview,
  };
}

/** URL to the user-guide site root (locale-aware), e.g. for "open in new tab" CTA. */
export function guideHomeUrl(uiLocale: string, basePath = ''): string {
  const locale = resolveGuideLocale(uiLocale);
  return `${basePath}/docs/user-guide/${locale}/index.html`;
}
