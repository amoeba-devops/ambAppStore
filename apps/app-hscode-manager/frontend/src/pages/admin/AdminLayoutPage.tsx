import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const TABS = [
  { to: 'import-countries', key: 'tabs.import_country' },
  { to: 'export-countries', key: 'tabs.export_country' },
  { to: 'exporters', key: 'tabs.exporter' },
  { to: 'data-sources', key: 'tabs.data_source' },
  { to: 'fta', key: 'tabs.fta' },
  { to: 'policy', key: 'tabs.policy' },
  { to: 'kpi', key: 'tabs.kpi' },
  { to: 'ucr', key: 'tabs.ucr' },
  { to: 'me', key: 'tabs.user' },
];

export function AdminLayoutPage() {
  const { t } = useTranslation('admin');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                clsx(
                  '-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                )
              }
            >
              {t(tab.key)}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
