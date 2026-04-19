import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  UserCheck,
  Kanban,
  PlusCircle,
  FilePenLine,
  FileText,
  Globe,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import { useDashboard } from '@/hooks/useMonitor';
import { useDispatches } from '@/hooks/useDispatches';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  badgeColor?: string;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('car');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: dashData } = useDashboard(isAuthenticated);
  const { data: pendingData } = useDispatches({ status: 'PENDING' }, isAuthenticated);

  const activeCount = dashData?.data?.dispatches?.inProgress || 0;
  const pendingCount = (pendingData?.data || []).length;

  const toggleLang = () => {
    const langs = ['ko', 'en', 'vi'];
    const idx = langs.indexOf(i18n.language);
    i18n.changeLanguage(langs[(idx + 1) % langs.length]);
  };

  const navItems: NavItem[] = [
    {
      to: '/',
      icon: LayoutDashboard,
      label: t('nav.monitor'),
      badge: activeCount || undefined,
      badgeColor: 'bg-orange-500',
    },
    {
      to: '/dispatches',
      icon: Kanban,
      label: t('nav.dispatchBoard'),
      badge: pendingCount || undefined,
      badgeColor: 'bg-yellow-500',
    },
    { to: '/dispatches/new', icon: PlusCircle, label: t('nav.dispatchRequest') },
    { to: '/trip-logs', icon: FileText, label: t('nav.tripLogs') },
    { to: '/trip-logs/new', icon: FilePenLine, label: t('nav.tripLogEntry') },
    { to: '/vehicles', icon: Car, label: t('nav.vehicleList') },
    { to: '/drivers', icon: UserCheck, label: t('nav.driverList') },
  ];

  const userName = user?.name || 'User';
  const initials = userName.charAt(0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6f8]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-[#e2e5eb] bg-white shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
        {/* Logo */}
        <div className="flex h-[60px] items-center gap-2.5 border-b border-[#e2e5eb] px-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500 text-[13px] font-bold text-white">
            🚗
          </div>
          <div>
            <div className="text-[13px] font-semibold text-gray-900">{t('common.appTitle')}</div>
            <div className="font-mono text-[10px] text-gray-400">app-car-manager</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/dispatches' || item.to === '/trip-logs'}
              className={({ isActive }) =>
                clsx(
                  'relative flex items-center gap-2.5 px-4 py-2 text-[13.5px] transition-colors',
                  isActive
                    ? 'border-r-2 border-orange-500 bg-orange-500/[0.08] text-orange-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-85" />
              <span>{item.label}</span>
              {item.badge != null && (
                <span
                  className={clsx(
                    'ml-auto rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white',
                    item.badgeColor || 'bg-orange-500',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Language + User */}
        <div className="border-t border-[#e2e5eb]">
          <button
            onClick={toggleLang}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-[12px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Globe className="h-4 w-4" />
            {i18n.language.toUpperCase()}
          </button>
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-700 text-[12px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 text-[12px]">
              <div className="truncate font-medium text-gray-900">{userName}</div>
              <div className="truncate text-gray-400">{user?.entityCode || ''}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
