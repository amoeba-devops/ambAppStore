const TITLE_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload Reports',
  '/manual-input': 'Manual Cost Input',
  '/cost-master/prime-cost': 'Prime Cost Master',
  '/cost-master/cogs-file': 'COGS File',
  '/reports/weekly': 'Weekly Report',
  '/activity-log/login': 'Login History',
  '/activity-log/action': 'Action History',
  '/activity-log/download': 'Download History',
};

export function pageTitleForPath(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname]!;
  const match = Object.keys(TITLE_MAP).find((p) => pathname.startsWith(p + '/'));
  return match ? TITLE_MAP[match]! : 'Sales Report';
}
