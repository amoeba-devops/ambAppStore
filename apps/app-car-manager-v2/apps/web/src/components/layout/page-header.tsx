import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@car-v2/ui';
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs';

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
   * Keep to 1 icon button — for primary mobile actions, prefer a FAB. */
  mobileAction?: React.ReactNode;
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
      {/* ── Mobile app bar (< md) ───────────────────────────────────────── */}
      <div className="md:hidden flex items-center gap-2 h-14 px-2">
        {back ? <BackButton href={back} ariaLabel={tL('back')} /> : <span className="w-10" aria-hidden />}
        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-md font-semibold text-text leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-text-muted truncate leading-tight">{subtitle}</p>}
        </div>
        <div className="min-w-[40px] flex items-center justify-end">
          {mobileAction}
        </div>
      </div>

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

function BackButton({ href, ariaLabel }: { href: string; ariaLabel: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={
        'inline-flex items-center justify-center h-10 w-10 rounded-full -ml-1 text-text-muted ' +
        'hover:bg-surface-2 hover:text-text active:bg-surface-2/80 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
      }
    >
      <ChevronLeft className="h-5 w-5" />
    </Link>
  );
}
