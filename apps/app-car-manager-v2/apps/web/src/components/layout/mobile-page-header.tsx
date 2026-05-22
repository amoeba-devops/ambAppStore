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
  /** Right-side action slot — appears only when caller passes `mobileAction`
   * on `<PageHeader>`. We do NOT fall back to the desktop `actions` slot,
   * since most list-page actions (e.g. "+ Create") are mirrored as a FAB on
   * mobile and would otherwise crowd the top bar. */
  rightSlot?: React.ReactNode;
  backAriaLabel: string;
  /** 'brand' = avatar + app name + tenant. Reserved for home routes
   * (dashboard / today). 'breadcrumb' (default) = back chevron + crumb trail,
   * which is what every other route uses to keep the top bar lightweight. */
  variant?: 'brand' | 'breadcrumb';
}

/**
 * Mobile-only top bar (rendered inside the server `<PageHeader>` for `< md`).
 *
 * Two layouts:
 *
 *  brand (home only):
 *    ┌──────────────────────────────────────────────────────────────┐
 *    │ [HV]  Fleet                                                  │
 *    │       Acme Vietnam                                           │
 *    └──────────────────────────────────────────────────────────────┘
 *
 *  breadcrumb (default — every non-home page):
 *    ┌──────────────────────────────────────────────────────────────┐
 *    │ [←]  Vehicles › 30A-12345                       [⋮ action]  │
 *    └──────────────────────────────────────────────────────────────┘
 *
 * Brand variant deliberately drops the breadcrumb + right action so the
 * top of the PWA home stays calm. Sub-pages get back chevron + crumb tail
 * so the user can read "where am I" on the LEFT, where the eye naturally
 * lands when arriving from a navigation tap.
 */
export function MobilePageHeader({
  title,
  breadcrumbs,
  back,
  rightSlot,
  backAriaLabel,
  variant = 'breadcrumb',
}: MobilePageHeaderProps) {
  if (variant === 'brand') {
    return <BrandHeader />;
  }
  return (
    <div className="md:hidden flex items-center gap-2 h-14 px-3">
      {back && (
        <Link
          href={back}
          aria-label={backAriaLabel}
          className={cn(
            'shrink-0 inline-flex items-center justify-center -ml-1 h-10 w-10 rounded-full',
            'text-text hover:bg-surface-2 active:bg-surface-2/80',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
      )}

      <div className="flex-1 min-w-0 flex items-center overflow-hidden">
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

/** Brand variant — used only on dashboard/today home pages. */
function BrandHeader() {
  const tenant = useTenantDisplay();
  return (
    <div className="md:hidden flex items-center gap-2 h-14 px-3">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="h-9 w-9 rounded-md bg-primary text-primary-fg flex items-center justify-center font-bold text-xs shrink-0"
          title={tenant.name}
        >
          {tenant.initials}
        </div>
        <div className="min-w-0">
          <div
            className="text-[13px] font-semibold text-text leading-tight truncate"
            title={tenant.appName}
          >
            {tenant.appName}
          </div>
          <div
            className="text-[10.5px] text-text-muted leading-tight truncate"
            title={tenant.name}
          >
            {tenant.name}
          </div>
        </div>
      </div>
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
  /* Strip the leading tenant-root crumb. Every page prepends `{ label: tenant }`
   * to convey "you're inside <Org>" — on mobile that prefix is filler since the
   * brand block already lives at the home, and on sub-pages the back chevron
   * conveys "you came from somewhere". We surface only the meaningful tail. */
  const meaningful = (items ?? []).filter((c, i) => !(i === 0 && !c.href));
  if (meaningful.length === 0) {
    return <span className="text-[15px] font-semibold text-text truncate">{fallback}</span>;
  }

  /* Cap to the last 2 to keep the bar compact on long trails. */
  const tail = meaningful.slice(-2);
  const elided = meaningful.length > tail.length;

  return (
    <div className="inline-flex items-center gap-1 text-[13px] text-text-muted min-w-0">
      {elided && (
        <>
          <span className="text-text-faint">…</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-faint shrink-0" aria-hidden />
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
                className={cn('truncate', isLast && 'font-semibold text-text text-[15px]')}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <ChevronRight className="h-3.5 w-3.5 text-text-faint shrink-0" aria-hidden />
            )}
          </span>
        );
      })}
    </div>
  );
}
