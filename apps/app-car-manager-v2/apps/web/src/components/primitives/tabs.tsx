'use client';

import { cn } from '@car-v2/ui/cn';

export type TabDef<K extends string = string> = {
  key: K;
  label: string;
  count?: number;
};

type Props<K extends string> = {
  tabs: readonly TabDef<K>[];
  active: K;
  onChange?: (key: K) => void;
  size?: 'sm' | 'md';
};

export function Tabs<K extends string>({ tabs, active, onChange, size = 'md' }: Props<K>) {
  const padding = size === 'sm' ? 'px-2.5 h-[28px]' : 'px-3 h-[34px]';
  return (
    <div className="inline-flex gap-1 border border-neutral-100 bg-neutral-25 rounded-lg p-1">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange?.(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md text-[12.5px] font-semibold transition-colors',
              padding,
              isActive
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'text-[10.5px] font-bold px-1.5 rounded-full',
                  isActive ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-500',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
