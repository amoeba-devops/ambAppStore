'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@car-v2/ui';
import { useTenantDisplay } from './tenant-display-context';
import type { BreadcrumbItem } from './breadcrumbs';

interface MobilePageHeaderProps {
  title: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  back?: string;
  /** Right-side action slot. Caller-provided `mobileAction` wins; otherwise we
   * fall back to the desktop `actions` so edit/delete buttons don't vanish on
   * narrow screens. Single icon button is the right shape — wrap multiple in
   * a kebab menu before passing. */
  rightSlot?: React.ReactNode;
  backAriaLabel: string;
}

/**
 * Mobile-only top bar (rendered inside the server `<PageHeader>` for `< md`).
 *
 * Layout — single 56px row, all sections truncate, never wraps:
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [←] [HV]  Fleet              Settings › Me      [⋮ action]  │
 *   │           HanaTech Vietnam                                    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Left identity block uses `useTenantDisplay()` so the same avatar + app +
 * tenant labels the desktop sidebar already shows are mirrored here on
 * mobile (which has no sidebar). Right side is a compact breadcrumb tail
 * (last two items) — falls back to the page `title` when no breadcrumbs
 * were passed. Long strings truncate with ellipsis; we never wrap.
 *
 * Back chevron is the small affordance to the left of the avatar — kept
 * outside the avatar so the avatar itself can stay a static brand mark.
 */
export function MobilePageHeader({
  title,
  breadcrumbs,
  back,
  rightSlot,
  backAriaLabel,
}: MobilePageHeaderProps) {
  const tenant = useTenantDisplay();

  return (
    <div className="md:hidden flex items-center gap-2 h-14 px-3">
      {back && (
        <Link
          href={back}
          aria-label={backAriaLabel}
          className={cn(
            'shrink-0 inline-flex items-center justify-center -ml-1 h-9 w-9 rounded-full',
            'text-text-muted hover:bg-surface-2 hover:text-text active:bg-surface-2/80',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}

      {/* Brand identity — avatar + app name + tenant name, truncate, no wrap. */}
      <div className="flex items-center gap-2 shrink min-w-0">
        <div
          className="h-9 w-9 rounded-md bg-primary text-primary-fg flex items-center justify-center font-bold text-xs shrink-0"
          title={tenant.name}
        >
          {tenant.initials}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text leading-tight truncate" title={tenant.appName}>
            {tenant.appName}
          </div>
          <div className="text-[10.5px] text-text-muted leading-tight truncate" title={tenant.name}>
            {tenant.name}
          </div>
        </div>
      </div>

      {/* Breadcrumb tail (or title fallback) — right-aligned, truncate intermediate
       * items, last item bold. We cap to the last 2 entries so a five-level
       * breadcrumb chain doesn't crush both ends of the bar. */}
      <div className="flex-1 min-w-0 flex items-center justify-end overflow-hidden">
        <CompactCrumbs items={breadcrumbs} fallback={title} />
      </div>

      {rightSlot && (
        <div className="shrink-0 flex items-center justify-end gap-1 max-w-[40%] overflow-hidden">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

function CompactCrumbs({
  items,
  fallback,
}: {
  items: BreadcrumbItem[] | undefined;
  fallback: React.ReactNode;
}) {
  if (!items || items.length === 0) {
    /* No breadcrumbs supplied — surface the page title instead so the bar
     * still conveys "what page is this". Single line, truncate. */
    return (
      <span className="text-[13px] font-semibold text-text truncate">{fallback}</span>
    );
  }

  /* Take the last two breadcrumb entries. Intermediate ancestors get an
   * ellipsis prefix so the user can tell hierarchy was elided. */
  const tail = items.slice(-2);
  const elided = items.length > tail.length;

  return (
    <div className="inline-flex items-center gap-1 text-[11px] text-text-muted min-w-0">
      {elided && (
        <>
          <span className="text-text-faint">…</span>
          <ChevronRight className="h-3 w-3 text-text-faint shrink-0" aria-hidden />
        </>
      )}
      {tail.map((item, i) => {
        const isLast = i === tail.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1 min-w-0">
            {item.href && !isLast ? (
              <Link href={item.href} className="truncate hover:text-text">
                {item.label}
              </Link>
            ) : (
              <span
                className={cn('truncate', isLast && 'font-semibold text-text')}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 text-text-faint shrink-0" aria-hidden />}
          </span>
        );
      })}
    </div>
  );
}
