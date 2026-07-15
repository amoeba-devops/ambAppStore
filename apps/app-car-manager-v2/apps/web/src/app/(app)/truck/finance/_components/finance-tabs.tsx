import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cn } from '@car-v2/ui';

/**
 * Shared finance tab bar (REQ-20260629 — design has ONE "Chi phí và Lợi nhuận"
 * menu). The per-trip view lives at /truck/finance; the P&L overview + month
 * close live at /truck/pnl. This bar unifies them under one menu so switching
 * tabs feels like one screen. Server component — plain links.
 */
export async function FinanceTabs({
  active,
  month,
  vehicleId,
}: {
  active: 'trips' | 'overview';
  month?: string;
  vehicleId?: string;
}) {
  const t = await getTranslations('screens.truckFinance');

  const withParams = (base: string) => {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (vehicleId) p.set('vehicle', vehicleId);
    const s = p.toString();
    return s ? `${base}${base.includes('?') ? '&' : '?'}${s}` : base;
  };

  const tabs: { key: typeof active; label: string; href: string }[] = [
    { key: 'trips', label: t('tabTrips'), href: withParams('/truck/finance') },
    { key: 'overview', label: t('tabOverview'), href: withParams('/truck/pnl?tab=overview') },
  ];

  return (
    <nav className="flex w-fit items-center gap-1 rounded-lg bg-surface-2 p-1">
      {tabs.map((tb) => (
        <Link
          key={tb.key}
          href={tb.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
            active === tb.key ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
          )}
        >
          {tb.label}
        </Link>
      ))}
    </nav>
  );
}
