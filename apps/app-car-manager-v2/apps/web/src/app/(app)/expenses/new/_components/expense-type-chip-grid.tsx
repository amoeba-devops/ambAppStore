'use client';

import { useTranslations } from 'next-intl';
import {
  ClipboardCheck,
  Coins,
  Droplet,
  Fuel,
  ParkingSquare,
  ShieldAlert,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@car-v2/ui';

export type ExpenseType =
  | 'FUEL'
  | 'OIL'
  | 'MEAL'
  | 'REPAIR'
  | 'PARKING'
  | 'TOLL'
  | 'ACCIDENT'
  | 'INSPECTION';

interface ExpenseTypeChipGridProps {
  value: ExpenseType | null;
  onChange: (v: ExpenseType) => void;
  /* aria-labelledby for the radiogroup. Pass the id of the visible label. */
  labelledBy?: string;
}

/* 8-chip radio group covering the MVP expense types. Renders as a 4×2 grid on
 * mobile / 4 col on tablet. Each chip is ≥80px tall — well within Apple HIG's
 * 44pt minimum and matches the visual weight of an iOS quick-action.
 *
 * Implements a proper WAI-ARIA radiogroup keyboard model — arrow keys cycle,
 * space/enter selects. That matters here because the chips replace what would
 * otherwise be a native `<select>`; without it, a screen-reader user has no
 * way to operate the picker. */
export function ExpenseTypeChipGrid({ value, onChange, labelledBy }: ExpenseTypeChipGridProps) {
  const t = useTranslations('costs.types');

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? (idx + 1) % TYPES.length
      : (idx - 1 + TYPES.length) % TYPES.length;
    const target = TYPES[next];
    if (target) onChange(target.id);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-4 gap-2"
    >
      {TYPES.map(({ id, Icon, tone }, idx) => {
        const selected = value === id;
        return (
          <div
            key={id}
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (value === null && idx === 0) ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onChange(id);
              } else {
                onKeyDown(e, idx);
              }
            }}
            className={cn(
              'cursor-pointer rounded-xl border-2 px-2 py-3 min-h-[80px]',
              'flex flex-col items-center justify-center gap-1.5 text-center',
              'transition-colors duration-150 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              selected
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-surface text-text hover:bg-surface-2',
            )}
          >
            <span
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                selected ? 'bg-accent text-accent-fg' : tone,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-medium leading-tight">{t(id)}</span>
          </div>
        );
      })}
    </div>
  );
}

interface TypeMeta {
  id: ExpenseType;
  Icon: LucideIcon;
  tone: string;
}

const TYPES: TypeMeta[] = [
  { id: 'FUEL',       Icon: Fuel,             tone: 'bg-accent-soft text-accent' },
  { id: 'OIL',        Icon: Droplet,          tone: 'bg-info-soft text-info' },
  { id: 'MEAL',       Icon: UtensilsCrossed,  tone: 'bg-warning-soft text-warning' },
  { id: 'REPAIR',     Icon: Wrench,           tone: 'bg-surface-2 text-text-muted' },
  { id: 'PARKING',    Icon: ParkingSquare,    tone: 'bg-surface-2 text-text-muted' },
  { id: 'TOLL',       Icon: Coins,            tone: 'bg-surface-2 text-text-muted' },
  { id: 'ACCIDENT',   Icon: ShieldAlert,      tone: 'bg-danger-soft text-danger' },
  { id: 'INSPECTION', Icon: ClipboardCheck,   tone: 'bg-success-soft text-success' },
];
