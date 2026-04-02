import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Barcode, Link2, FileBarChart,
  CalendarDays, CalendarRange, Video, Users, PenLine,
  Settings, Bell, Globe, LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';

interface NavItem { to: string; icon: typeof LayoutDashboard; label: string; }
interface NavSection { label: string; items: NavItem[]; }

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('sales');
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const toggleLang = () => {
    const langs = ['ko', 'en', 'vi'];
    const idx = langs.indexOf(i18n.language);
    i18n.changeLanguage(langs[(idx + 1) % langs.length]);
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/entity-info');
  };

  const sections: NavSection[] = [
    {
      label: '',
      items: [{ to: '/', icon: LayoutDashboard, label: t('nav.dashboard') }],
    },
    {
      label: t('nav.sectionProduct'),
      items: [
        { to: '/spu', icon: Package, label: t('nav.spuMaster') },
        { to: '/sku', icon: Barcode, label: t('nav.skuMaster') },
        { to: '/channel-mapping', icon: Link2, label: t('nav.channelMapping') },
      ],
    },
    {
      label: t('nav.sectionReport'),
      items: [
        { to: '/daily-report', icon: FileBarChart, label: t('nav.dailyReport') },
        { to: '/weekly-cm', icon: CalendarDays, label: t('nav.weeklyCm') },
        { to: '/monthly-cm', icon: CalendarRange, label: t('nav.monthlyCm') },
        { to: '/livestream', icon: Video, label: t('nav.livestream') },
        { to: '/creator', icon: Users, label: t('nav.creator') },
      ],
    },
    {
      label: t('nav.sectionInput'),
      items: [
        { to: '/manual-input', icon: PenLine, label: t('nav.manualInput') },
      ],
    },
    {
      label: t('nav.sectionSettings'),
      items: [
        { to: '/settings', icon: Settings, label: t('nav.settings') },
        { to: '/notifications', icon: Bell, label: t('nav.notifications') },
      ],
    },
  ];

  const userName = user?.name || 'User';
  const initials = userName.charAt(0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6f8]">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-[#e2e5eb] bg-white shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
        <div className="flex h-[60px] items-center gap-2.5 border-b border-[#e2e5eb] px-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[13px] font-bold text-white">📊</div>
          <div>
            <div className="text-[13px] font-semibold text-gray-900">{t('common.appTitle')}</div>
            <div className="font-mono text-[10px] text-gray-400">sales-report</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section, si) => (
            <div key={si} className="py-1">
              {section.label && (
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{section.label}</div>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'relative flex items-center gap-2.5 px-4 py-2 text-[13.5px] transition-colors',
                      isActive ? 'border-r-2 border-blue-500 bg-blue-500/[0.08] text-blue-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-85" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-[#e2e5eb]">
          <button onClick={toggleLang} className="flex w-full items-center gap-2.5 px-4 py-2 text-[12px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
            <Globe className="h-4 w-4" />
            {i18n.language.toUpperCase()}
          </button>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-700 text-[12px] font-semibold text-white">{initials}</div>
              <div className="min-w-0 text-[12px]">
                <div className="truncate font-medium text-gray-900">{userName}</div>
                <div className="truncate text-gray-400">{user?.role || ''}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600" title={t('auth.logout')}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-60 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
