import type { LocalRole } from '@v2/shared/auth';
import {
  LayoutDashboard,
  Upload,
  Archive,
  Database,
  BarChart3,
  CalendarRange,
  TrendingUp,
  ScrollText,
  Users,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** i18n key under `nav.item.*`. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  roles?: readonly LocalRole[];
  /** Source key for the dynamic badge count rendered next to the label. */
  badge?: 'pending-approval';
}

export interface NavSection {
  /** i18n key under `nav.section.*`. Omit for an untitled section. */
  titleKey?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      { labelKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    items: [
      {
        labelKey: 'uploadReports',
        href: '/upload',
        icon: Upload,
        roles: ['OPERATOR', 'ADMIN'],
      },
    ],
  },
  {
    titleKey: 'dataIngest',
    items: [
      {
        labelKey: 'rawArchive',
        href: '/raw-archive',
        icon: Archive,
        badge: 'pending-approval',
      },
    ],
  },
  {
    titleKey: 'rfrData',
    items: [
      {
        labelKey: 'primeCost',
        href: '/cost-master/prime-cost',
        icon: Database,
        roles: ['OPERATOR', 'ADMIN'],
      },
    ],
  },
  {
    titleKey: 'reports',
    items: [
      { labelKey: 'weeklyReport', href: '/reports/weekly', icon: BarChart3 },
      { labelKey: 'monthlyReport', href: '/reports/monthly', icon: CalendarRange },
      { labelKey: 'trendingReport', href: '/reports/trending', icon: TrendingUp },
    ],
  },
  {
    titleKey: 'audit',
    items: [
      {
        labelKey: 'activityLog',
        href: '/activity-log/action',
        icon: ScrollText,
        roles: ['MANAGER', 'ADMIN'],
      },
    ],
  },
  {
    titleKey: 'settings',
    items: [
      {
        labelKey: 'userManagement',
        href: '/settings/users',
        icon: Users,
        roles: ['ADMIN'],
      },
      {
        labelKey: 'formulaConfig',
        href: '/settings/formula-config',
        icon: SlidersHorizontal,
        roles: ['ADMIN'],
      },
    ],
  },
];

export function filterNavByRole(sections: NavSection[], role: LocalRole): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
