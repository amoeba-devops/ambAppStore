import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, AppWindow, BarChart3, ArrowLeft, Bug } from 'lucide-react';
import { clsx } from 'clsx';

const DEBUG_LS_KEY = 'debug_panel_enabled';

const navItems = [
  { to: '/admin/subscriptions', icon: LayoutDashboard, labelKey: 'nav.subscriptions' },
  { to: '/admin/apps', icon: AppWindow, labelKey: 'nav.apps' },
  { to: '/admin/stats', icon: BarChart3, labelKey: 'nav.stats' },
] as const;

export function AdminLayout() {
  const { t } = useTranslation('admin');
  const [debugEnabled, setDebugEnabled] = useState(
    () => localStorage.getItem(DEBUG_LS_KEY) === 'true',
  );

  const handleDebugToggle = () => {
    const next = !debugEnabled;
    setDebugEnabled(next);
    localStorage.setItem(DEBUG_LS_KEY, next ? 'true' : 'false');
    window.dispatchEvent(new Event('debug-panel-toggle'));
  };

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
          <hr className="my-3" />
          <button
            onClick={handleDebugToggle}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Bug size={18} />
              {t('debug.toggleLabel')}
            </span>
            <span
              className={clsx(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                debugEnabled ? 'bg-indigo-600' : 'bg-gray-300',
              )}
            >
              <span
                className={clsx(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
                  debugEnabled ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
