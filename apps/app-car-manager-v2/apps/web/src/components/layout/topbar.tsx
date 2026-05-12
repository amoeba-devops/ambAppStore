import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Icon } from '../primitives/icon';

type Props = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
};

export async function TopBar({ title, subtitle, breadcrumbs, actions }: Props) {
  const t = await getTranslations();
  return (
    <div className="border-b border-neutral-100 bg-white px-7 py-3.5 flex items-center gap-[18px] justify-between">
      <div className="flex items-center gap-3.5 min-w-0">
        <div>
          {breadcrumbs && (
            <div className="text-[11.5px] text-neutral-400 flex items-center gap-1.5 mb-0.5">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <Icon name="chev" size={11} color="#a8b1c0" />}
                  <span className={i === breadcrumbs.length - 1 ? 'text-neutral-600' : 'text-neutral-400'}>
                    {b}
                  </span>
                </span>
              ))}
            </div>
          )}
          <div className="text-[19px] font-extrabold text-neutral-900 tracking-[-0.022em]">{title}</div>
          {subtitle && <div className="text-[12.5px] text-neutral-500 mt-0.5">{subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-1.5 text-neutral-400 text-[12.5px] w-[280px]">
          <Icon name="search" size={14} />
          <span>{t('search.placeholder')}</span>
          <span className="ml-auto font-mono text-[11px] text-neutral-300">⌘K</span>
        </div>
        <button
          type="button"
          className="w-9 h-9 rounded-lg border border-neutral-100 bg-white flex items-center justify-center cursor-pointer relative hover:bg-neutral-25"
        >
          <Icon name="bell" size={16} color="#5b6374" />
          <span className="absolute top-[7px] right-2 w-[7px] h-[7px] rounded-full bg-danger-500 border-2 border-white" />
        </button>
        {actions}
      </div>
    </div>
  );
}
