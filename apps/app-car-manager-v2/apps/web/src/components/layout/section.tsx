import type { ReactNode } from 'react';

/** Section header — used inside Cards / detail pages. Matches prototype SectionHeader. */
type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 pb-3">
      <div>
        <div className="text-[15px] font-extrabold text-neutral-900 tracking-[-0.02em]">{title}</div>
        {subtitle && <div className="text-[12.5px] text-neutral-500 mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
