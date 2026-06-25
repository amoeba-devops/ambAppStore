'use client';

import { useTranslations } from 'next-intl';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@car-v2/ui';
import type { TripViewMode } from '@/hooks/use-trip-view-mode';

interface TripViewSwitchProps {
  value: TripViewMode;
  onChange: (m: TripViewMode) => void;
  className?: string;
}

/**
 * Segmented Kanban / List control. Presentational only — the owner wires
 * `value`/`onChange` to either a URL param (main list page) or sessionStorage
 * (detail pages). Icon-only on mobile to save horizontal space, icon+label on
 * desktop.
 */
export function TripViewSwitch({ value, onChange, className }: TripViewSwitchProps) {
  const t = useTranslations('trips.board');
  const items: Array<{ key: TripViewMode; label: string; Icon: typeof LayoutGrid }> = [
    { key: 'kanban', label: t('viewKanban'), Icon: LayoutGrid },
    { key: 'list', label: t('viewList'), Icon: List },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('switchAria')}
      className={cn('inline-flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5', className)}
    >
      {items.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex items-center justify-center h-8 w-8 rounded transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
