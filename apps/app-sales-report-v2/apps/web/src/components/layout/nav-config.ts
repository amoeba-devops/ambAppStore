import type { LocalRole } from '@v2/shared/auth';
import {
  LayoutDashboard,
  Upload,
  Pencil,
  Database,
  FileText,
  BarChart3,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: readonly LocalRole[];
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
    title: 'Operations',
    items: [
      {
        label: 'Upload',
        href: '/upload',
        icon: Upload,
        roles: ['OPERATOR', 'ADMIN'],
      },
      {
        label: 'Manual Input',
        href: '/manual-input',
        icon: Pencil,
        roles: ['OPERATOR', 'ADMIN'],
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
      {
        label: 'COGS File',
        href: '/cost-master/cogs-file',
        icon: FileText,
        roles: ['OPERATOR', 'ADMIN'],
      },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Weekly Report', href: '/reports/weekly', icon: BarChart3 },
    ],
  },
  {
    title: 'Audit',
    items: [
      {
        label: 'Login History',
        href: '/activity-log/login',
        icon: ScrollText,
        roles: ['MANAGER', 'ADMIN'],
      },
      {
        label: 'Action History',
        href: '/activity-log/action',
        icon: ScrollText,
        roles: ['MANAGER', 'ADMIN'],
      },
      {
        label: 'Download History',
        href: '/activity-log/download',
        icon: ScrollText,
        roles: ['MANAGER', 'ADMIN'],
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
