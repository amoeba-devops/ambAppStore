import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, AppWindow, BarChart3, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { to: '/admin/subscriptions', icon: LayoutDashboard, labelKey: 'nav.subscriptions' },
  { to: '/admin/apps', icon: AppWindow, labelKey: 'nav.apps' },
  { to: '/admin/stats', icon: BarChart3, labelKey: 'nav.stats' },
] as const;

export function AdminLayout() {
  const { t } = useTranslation('admin');

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-white">
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map(({ to, icon: Icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100',
                )
              }
            >
              <Icon size={18} />
              {t(labelKey)}
            </NavLink>
          ))}
          <hr className="my-3" />
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft size={18} />
            {t('nav.backToStore')}
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
