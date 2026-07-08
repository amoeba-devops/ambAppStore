import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { DebugContextPanel } from './components/common/DebugContextPanel';

const NAV = [
  { to: '/search/qa', key: 'nav.qa' },
  { to: '/search/barcode', key: 'nav.barcode' },
  { to: '/search/attribute', key: 'nav.attr' },
  { to: '/result', key: 'nav.result' },
  { to: '/reference', key: 'nav.reference' },
  { to: '/admin', key: 'nav.admin' },
];

const LANGS = ['ko', 'en', 'vi'] as const;

export default function App() {
  const { t, i18n } = useTranslation('hscode');

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-6 py-3">
        <div className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-gradient-to-br from-brand to-brand-dark text-xs font-extrabold text-white">
            HS
          </span>
          HS Code Manager
          <small className="font-medium text-muted">{t('brand.sub')}</small>
        </div>

        <nav className="flex flex-wrap gap-1 rounded-[10px] bg-[#f3f4f6] p-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                clsx(
                  'rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition',
                  isActive
                    ? 'bg-white text-brand-dark shadow-sm'
                    : 'text-muted hover:text-ink',
                )
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-line2">
            {LANGS.map((l) => (
              <button
                key={l}
                onClick={() => i18n.changeLanguage(l)}
                className={clsx(
                  'px-2.5 py-1.5 text-xs font-bold transition',
                  i18n.language === l
                    ? 'bg-brand text-white'
                    : 'bg-white text-muted',
                )}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-14">
        <Outlet />
      </main>

      <DebugContextPanel />
    </div>
  );
}
