'use client';

import type { HTMLAttributes, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { TableRow, cn } from '@car-v2/ui';

interface ClickableTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Destination navigated to on row click / Enter / Space. */
  href: string;
  /** Pass false for query-param "peek" navigations that must not jump scroll. */
  scroll?: boolean;
}

/**
 * A table row that navigates on click — lets the whole row act as the link so
 * users don't have to hit a dedicated "View" button. Interactive children
 * (buttons, switches, links) must call `e.stopPropagation()` so they don't
 * trigger the row navigation.
 */
export function ClickableTableRow({ href, scroll = true, className, children, ...rest }: ClickableTableRowProps) {
  const router = useRouter();
  const go = () => router.push(href, { scroll });

  return (
    <TableRow
      role="link"
      tabIndex={0}
      className={cn('cursor-pointer', className)}
      onClick={go}
      onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      {...rest}
    >
      {children}
    </TableRow>
  );
}

interface ClickableCardProps extends HTMLAttributes<HTMLDivElement> {
  href: string;
  scroll?: boolean;
}

/**
 * Clickable card (non-table) that navigates on click — used for mobile list
 * cards where a `<tr>` doesn't apply and an `<a>` wrapper would be invalid
 * around nested interactive controls. Wrap such controls in `StopRowClick`.
 */
export function ClickableCard({ href, scroll = true, className, children, ...rest }: ClickableCardProps) {
  const router = useRouter();
  const go = () => router.push(href, { scroll });

  return (
    <div
      role="link"
      tabIndex={0}
      className={cn('cursor-pointer', className)}
      onClick={go}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Wrap an interactive control (button, switch, link) inside a ClickableTableRow
 * or ClickableCard so clicking / keying it doesn't also fire the row
 * navigation. Server pages can't attach event handlers themselves, so this
 * client wrapper owns them.
 */
export function StopRowClick({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}
