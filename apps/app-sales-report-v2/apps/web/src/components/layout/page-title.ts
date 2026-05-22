/**
 * Map a pathname to a translation key under the `pageTitle.*` namespace.
 * Returns `'fallback'` when no prefix matches.
 */
const TITLE_KEY_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/upload': 'upload',
  '/raw-archive': 'rawArchive',
  '/manual-input': 'manualInput',
  '/cost-master/prime-cost': 'primeCost',
  '/reports/weekly': 'weeklyReport',
  '/reports/monthly': 'monthlyReport',
  '/reports/trending': 'trendingReport',
  '/activity-log/action': 'activityLog',
  '/settings/users': 'userManagement',
  '/settings/formula-config': 'formulaConfig',
};

export function pageTitleKeyForPath(pathname: string): string {
  if (TITLE_KEY_MAP[pathname]) return TITLE_KEY_MAP[pathname]!;
  const match = Object.keys(TITLE_KEY_MAP).find((p) => pathname.startsWith(p + '/'));
  return match ? TITLE_KEY_MAP[match]! : 'fallback';
}
