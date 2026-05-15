const TITLE_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload Reports',
  '/raw-archive': 'Raw Archive',
  '/manual-input': 'Manual Cost Input',
  '/cost-master/prime-cost': 'Prime Cost Master',
  '/reports/weekly': 'Weekly Report',
  '/reports/monthly': 'Monthly Report',
  '/reports/trending': 'Trending Report',
  '/activity-log/action': 'Activity Log',
  '/settings/users': 'User Management',
  '/settings/formula-config': 'Formula Config',
};

export function pageTitleForPath(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname]!;
  const match = Object.keys(TITLE_MAP).find((p) => pathname.startsWith(p + '/'));
  return match ? TITLE_MAP[match]! : 'Sales Report';
}
