import type { ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';

/**
 * List-page shell — used for /trips, /costs, /vehicles, /drivers, /users, /audit.
 * Layout: filter-bar (tabs + actions) → content (table or split view).
 */
type Props = {
  /** Tab strip or filter chips (left side of filter bar) */
  filters?: ReactNode;
  /** Action buttons (right side) — Search input, "Export", "New ..." */
  actions?: ReactNode;
  children: ReactNode;
  /** Container variant: 'card' wraps content in a Card, 'plain' is flush */
  variant?: 'card' | 'plain';
};

export function ListPageShell({ filters, actions, children, variant = 'card' }: Props) {
  return (
    <div className="flex flex-col h-full">
      {(filters || actions) && (
        <div className="flex items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">{filters}</div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div
        className={cn(
          'flex-1 min-h-0',
          variant === 'card' && 'bg-white border border-neutral-100 rounded-xl overflow-hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}
