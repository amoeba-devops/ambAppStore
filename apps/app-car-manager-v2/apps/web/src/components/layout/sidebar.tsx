import { getTranslations } from 'next-intl/server';
import { Icon } from '../primitives/icon';
import { Avatar } from '../primitives/avatar';
import { Logo } from './logo';
import { NavList } from './nav-list';

/**
 * Sidebar shell (Server Component). Renders brand, org switcher, user card.
 * NavList is a Client Component — handles active state via usePathname() + Link.
 */
export async function Sidebar() {
  const tNav = await getTranslations('nav');
  const t = await getTranslations();

  const labels = {
    workspace: t('workspace'),
    admin: t('admin'),
    dashboard: tNav('dashboard'),
    trips: tNav('trips'),
    costs: tNav('costs'),
    vehicles: tNav('vehicles'),
    drivers: tNav('drivers'),
    users: tNav('users'),
    reports: tNav('reports'),
    settings: tNav('settings'),
    audit: tNav('auditLog'),
  };

  return (
    <aside className="flex flex-col h-full bg-white border-r border-neutral-100 w-[244px] flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-[18px] pt-5 pb-[18px]">
        <Logo size={28} />
        <div className="overflow-hidden">
          <div className="text-[15px] font-extrabold tracking-[-0.02em] text-neutral-900">
            {t('appName')}
          </div>
          <div className="text-[11.5px] text-neutral-400 mt-px font-medium">
            {t('company.tenantShort')}
          </div>
        </div>
      </div>

      {/* Org switcher (UI only — wires in P1+) */}
      <div className="px-3 pb-3">
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-neutral-100 bg-neutral-25 cursor-pointer text-left hover:bg-neutral-50 transition-colors"
        >
          <div className="w-[22px] h-[22px] rounded bg-brand-500 text-white flex items-center justify-center text-[11px] font-extrabold">
            {t('company.tenantInitial')}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-[12.5px] font-bold text-neutral-800 truncate">
              {t('company.tenant')}
            </div>
            <div className="text-[11px] text-neutral-400">{t('company.tenantMeta')}</div>
          </div>
          <Icon name="chevd" size={14} color="#7e8799" />
        </button>
      </div>

      <NavList labels={labels} />

      {/* User card (UI only) */}
      <div className="border-t border-neutral-100 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={t('company.currentUser')} size={32} />
          <div className="flex-1 overflow-hidden">
            <div className="text-[12.5px] font-bold text-neutral-800">
              {t('company.currentUser')}
            </div>
            <div className="text-[11px] text-neutral-400">{t('company.currentUserRole')}</div>
          </div>
          <Icon name="more" size={16} color="#7e8799" />
        </div>
      </div>
    </aside>
  );
}
