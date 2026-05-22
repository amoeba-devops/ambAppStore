import { getTranslations } from 'next-intl/server';
import { cn } from '@car-v2/ui';
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs';
import { MobilePageHeader } from './mobile-page-header';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  /* Back affordance for mobile app-bar pattern. Renders a chevron-left link
   * on the left edge of the bar that navigates to `back` (href). Desktop
   * ignores this — the breadcrumb trail already conveys hierarchy. */
  back?: string;
  /* Optional mobile-only action slot in the app-bar top-right (icon size).
   * Keep to 1 icon button — for primary mobile actions, prefer a FAB.
   * We intentionally do NOT fall back to `actions`: most desktop `actions`
   * are list-page "+ Create" buttons that already have a mobile FAB. */
  mobileAction?: React.ReactNode;
  /* Mobile header layout. 'brand' (avatar + app + tenant) is reserved for
   * home routes — dashboard / today. Everything else uses 'breadcrumb'
   * (back chevron + breadcrumb tail on the LEFT) so the top bar stays
   * lightweight and the user can scan hierarchy at a glance. */
  mobileVariant?: 'brand' | 'breadcrumb';
  /* Tight variant trims vertical padding for detail/form pages. */
  density?: 'comfortable' | 'tight';
  className?: string;
}

export async function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  back,
  mobileAction,
  mobileVariant = 'breadcrumb',
  density = 'comfortable',
  className,
}: PageHeaderProps) {
  const tL = await getTranslations('layout');
  return (
    <header
      className={cn(
        'sticky top-0 z-20 bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70',
        'border-b border-border',
        /* iPhone Dynamic Island / notch in PWA standalone: without this top
         * inset the page title gets clipped behind the status-bar cutout.
         * Safari without notches reports `env(...)` as 0, so this is a no-op
         * on desktop and Android. The fallback `0px` matters for older
         * Chrome on Android where the env() value isn't supported. */
        'pt-[env(safe-area-inset-top,0px)]',
        className,
      )}
    >
      {/* ── Mobile app bar (< md) ─────────────────────────────────────────
       * Delegated to the client component so it can read the tenant display
       * context (avatar initials + app name + tenant name). Only `mobileAction`
       * lands in the mobile right slot — `actions` is desktop-only. Pages that
       * need an action on mobile must pass `mobileAction` explicitly (or rely
       * on the FAB pattern for the primary "create" action). */}
      <MobilePageHeader
        title={title}
        breadcrumbs={breadcrumbs}
        back={back}
        rightSlot={mobileAction}
        backAriaLabel={tL('back')}
        variant={mobileVariant}
      />

      {/* ── Desktop chrome (≥ md) ───────────────────────────────────────── */}
      <div
        className={cn(
          'hidden md:block',
          density === 'comfortable' ? 'px-7 pt-5 pb-4' : 'px-7 pt-4 pb-3',
        )}
      >
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-2">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-text leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

