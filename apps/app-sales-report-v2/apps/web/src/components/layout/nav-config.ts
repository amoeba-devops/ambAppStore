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
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: readonly LocalRole[];
  /** Source key for the dynamic badge count rendered next to the label. */
  badge?: 'pending-approval';
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    items: [
      {
        label: 'Upload Reports',
        href: '/upload',
        icon: Upload,
        roles: ['OPERATOR', 'ADMIN'],
      },
    ],
  },
  {
    title: 'Data Ingest',
    items: [
      {
        label: 'Raw archive',
        href: '/raw-archive',
        icon: Archive,
        badge: 'pending-approval',
      },
    ],
  },
  {
    title: 'RFR Data',
    items: [
      {
        label: 'Prime Cost',
        href: '/cost-master/prime-cost',
        icon: Database,
        roles: ['OPERATOR', 'ADMIN'],
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Weekly Report', href: '/reports/weekly', icon: BarChart3 },
      { label: 'Monthly Report', href: '/reports/monthly', icon: CalendarRange },
      { label: 'Trending Report', href: '/reports/trending', icon: TrendingUp },
    ],
  },
  {
    items: [
      {
        label: 'Activity Log',
        href: '/activity-log/action',
        icon: ScrollText,
        roles: ['MANAGER', 'ADMIN'],
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        label: 'User Management',
        href: '/settings/users',
        icon: Users,
        roles: ['ADMIN'],
      },
      {
        label: 'Formula Config',
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
