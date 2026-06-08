import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  LayoutDashboard,
  PlusCircle,
  Database,
  ShieldCheck,
  Settings,
  Globe,
  User,
  GraduationCap,
} from 'lucide-react';
import i18n from '@/i18n/i18n';
import { useAuthStore } from '@/stores/auth.store';

const NAV: Array<{ to: string; key: string; icon: typeof LayoutDashboard }> = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/new-work', key: 'nav.new_work', icon: PlusCircle },
  { to: '/classifications', key: 'nav.history', icon: Database },
  { to: '/verification', key: 'nav.verification', icon: ShieldCheck },
  { to: '/expert-reviews', key: 'nav.expert', icon: GraduationCap },
  { to: '/admin', key: 'nav.admin', icon: Settings },
];

function LanguageSwitcher() {
  const { i18n: i } = useTranslation();
  const opts: Array<{ code: 'ko' | 'en' | 'vi'; label: string }> = [
    { code: 'ko', label: '한' },
    { code: 'en', label: 'EN' },
    { code: 'vi', label: 'VI' },
  ];
  return (
    <div className="flex items-center gap-1 text-xs">
      <Globe className="h-4 w-4 text-gray-400" />
      {opts.map((o, idx) => (
        <span key={o.code} className="flex items-center">
          {idx > 0 && <span className="mx-1 text-gray-300">·</span>}
          <button
            type="button"
            onClick={() => i18n.changeLanguage(o.code)}
            className={clsx(
              'transition-colors',
              i.language === o.code
                ? 'font-semibold text-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {o.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-900">{t('app.title')}</span>
          <span className="hidden text-xs text-gray-400 sm:inline">
            {t('app.subtitle')}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <User className="h-4 w-4 text-gray-400" />
            {user?.name || user?.email || '—'}
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-56 border-r border-gray-200 bg-white py-4">
          <nav className="flex flex-col gap-1 px-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t(item.key)}
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
