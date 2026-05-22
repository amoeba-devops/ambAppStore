'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
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
 * Two layouts, picked by `variant`:
 *
 *   brand (home only — dashboard / today):
 *     ┌──────────────────────────────────────────────────────────────┐
 *     │ [HV]  Fleet                                    [👤]          │
 *     │       Acme Vietnam                                           │
 *     └──────────────────────────────────────────────────────────────┘
 *
 *   breadcrumb (default, every non-home page):
 *     ┌──────────────────────────────────────────────────────────────┐
 *     │ [←]  Vehicles › 30A-12345               [⋮ act]  [👤]        │
 *     └──────────────────────────────────────────────────────────────┘
 *
 * Both variants pin the Me avatar to the right edge — replaces the `me`
 * BottomTabNav slot we retired so the user still has a permanent escape
 * into profile / locale / sign-out without relying on a tab.
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

      {/* Explicit per-page action (rare) — sits LEFT of the persistent Me
       * avatar so the avatar always anchors the right edge. Pages that
       * just need Edit/Delete should now render those inline inside the
       * page's primary card; this slot is reserved for things that truly
       * need the header (e.g. "Mark all read" on /inbox). */}
      {rightSlot && (
        <div className="shrink-0 flex items-center justify-end gap-1 max-w-[35%] overflow-hidden">
          {rightSlot}
        </div>
      )}

      <MeAvatarLink />
    </div>
  );
}

/* Persistent "Me" affordance pinned to the top-right of every mobile
 * header. Replaces the slot the `me` BottomTabNav tile used to occupy —
 * with the tab gone, the user still needs a always-visible escape into
 * profile / locale / sign-out, and a header avatar is the iOS/Android
 * convention for "current user". Tap navigates to `/settings/me`; from
 * there the user can sign out, switch language, etc. */
function MeAvatarLink() {
  const tNav = useTranslations('nav');
  return (
    <Link
      href="/settings/me"
      aria-label={tNav('me')}
      title={tNav('me')}
      className={cn(
        'shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full',
        'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text active:bg-surface-2/80',
        'transition-colors duration-150 motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      )}
    >
      <UserIcon className="h-4 w-4" aria-hidden />
    </Link>
  );
}

/** Brand variant — used only on dashboard/today home pages. Me avatar
 * pinned to the right matches the breadcrumb variant so the user has the
 * same "current user" affordance in the same spot regardless of route. */
function BrandHeader() {
  const tenant = useTenantDisplay();
  return (
    <div className="md:hidden flex items-center gap-2 h-14 px-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
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
      <MeAvatarLink />
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

  /* Cap to the last 2 entries so a five-level chain still fits on a 360px
   * viewport. Intermediate ancestors get an ellipsis prefix so the user
   * knows hierarchy was elided. */
  const tail = meaningful.slice(-2);
  const elided = meaningful.length > tail.length;

  return (
    <div className="inline-flex items-center gap-1 text-[13px] text-text-muted min-w-0">
      {elided && (
        <>
          <span className="text-text-faint shrink-0">…</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-faint shrink-0" aria-hidden />
        </>
      )}
      {tail.map((item, i) => {
        const isLast = i === tail.length - 1;
        /* Last item bold + larger font for prominence; intermediate items
         * use the smaller muted style. Both truncate independently so a
         * long current-page label can shrink without erasing the ancestor. */
        return (
          <span
            key={`${item.label}-${i}`}
            className="inline-flex items-center gap-1 min-w-0 shrink"
          >
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
