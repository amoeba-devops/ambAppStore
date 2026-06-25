import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Card, cn } from '@car-v2/ui';
import { computeTruckPnl, type TruckPnlRow } from '@car-v2/core/truck';
import { PageHeader } from '@/components/layout/page-header';
import { MonthPicker } from '@/components/inputs/month-picker';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { getTruckFixedCostsByMonth } from '@/server/queries/truck-fixed-cost.queries';
import {
  isTruckMonthClosed,
  listFuelInvoices,
  getTruckFuelStats,
} from '@/server/queries/truck-finance.queries';
import { TruckFixedCostRow } from '../settings/_components/truck-fixed-cost-row';
import { MonthCloseControls } from './_components/month-close-controls';
import { FuelInvoicePanel } from './_components/fuel-invoice-panel';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** The selected month plus the two before it (oldest first). */
function threeMonthsEnding(month: string): string[] {
  const d = new Date(`${month}-01T00:00:00Z`);
  return [2, 1, 0].map((i) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7),
  );
}

interface MetricDef {
  key: keyof TruckPnlRow;
  labelKey: string;
  kind?: 'subtotal' | 'profit' | 'count';
}

const METRICS: MetricDef[] = [
  { key: 'revenue', labelKey: 'revenue' },
  { key: 'fuelCost', labelKey: 'fuel' },
  { key: 'tollFee', labelKey: 'toll' },
  { key: 'extraTotal', labelKey: 'other' },
  { key: 'variableCost', labelKey: 'variable', kind: 'subtotal' },
  { key: 'salary', labelKey: 'salary' },
  { key: 'depreciation', labelKey: 'depreciation' },
  { key: 'insurance', labelKey: 'insurance' },
  { key: 'driverSalary', labelKey: 'driverSalary' },
  { key: 'fixedCost', labelKey: 'fixed', kind: 'subtotal' },
  { key: 'tripCount', labelKey: 'trips', kind: 'count' },
  { key: 'netProfit', labelKey: 'netProfit', kind: 'profit' },
];

export default async function TruckPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();

  const t = await getTranslations('screens.truckPnl');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const vehicleId = sp.vehicle && trucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  const months = threeMonthsEnding(month);
  const [rows, closed, fixedMap, invoices, fuelStats] = await Promise.all([
    computeTruckPnl(user, { vehicleId, months }),
    isTruckMonthClosed(user.entId, month),
    getTruckFixedCostsByMonth(user.entId, month),
    listFuelInvoices(user.entId, month),
    getTruckFuelStats(user.entId, month),
  ]);

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const monthLabel = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short', year: '2-digit' });
  const fmt = (def: MetricDef, n: number) => (def.kind === 'count' ? n.toLocaleString(loc) : vnd(n));

  const chipHref = (v?: string) => `/truck/pnl?month=${month}${v ? `&vehicle=${v}` : ''}`;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckPnl') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        {/* Month + close/reopen */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-muted">{t('monthLabel')}</span>
            <MonthPicker value={month} />
          </div>
          <MonthCloseControls month={month} closed={closed} />
        </div>

        {/* P&L table */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip href={chipHref()} active={!vehicleId} label={t('allTrucks')} />
            {trucks.map((v) => (
              <Chip key={v.cvhId} href={chipHref(v.cvhId)} active={vehicleId === v.cvhId} label={v.cvhPlateNumber} />
            ))}
          </div>

          <Card variant="outline" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-semibold text-text-muted px-4 py-2.5">{t('metric')}</th>
                  {months.map((m) => (
                    <th key={m} className="text-right font-semibold text-text-muted px-4 py-2.5 whitespace-nowrap">
                      {monthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((def) => (
                  <tr
                    key={def.key}
                    className={cn(
                      'border-b border-border last:border-0',
                      def.kind === 'subtotal' && 'bg-surface-2/60 font-medium',
                      def.kind === 'profit' && 'bg-text/[0.03] font-bold',
                    )}
                  >
                    <td className="px-4 py-2.5 text-text">{t(def.labelKey)}</td>
                    {rows.map((row) => {
                      const n = row[def.key] as number;
                      return (
                        <td
                          key={`${def.key}-${row.month}`}
                          className={cn(
                            'px-4 py-2.5 text-right tabular whitespace-nowrap',
                            def.kind === 'profit' && (n >= 0 ? 'text-success' : 'text-danger'),
                          )}
                        >
                          {fmt(def, n)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Fuel-invoice ledger for the selected month */}
        <FuelInvoicePanel month={month} invoices={invoices} stats={fuelStats} locked={closed} />

        {/* Fixed costs for the selected month */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text">{t('fixedCostsTitle', { month })}</h2>
          {trucks.length === 0 ? (
            <Card variant="outline" className="p-6 text-center text-sm text-text-muted">{t('noTrucks')}</Card>
          ) : (
            <div className="space-y-3">
              {trucks.map((v) => (
                <TruckFixedCostRow
                  key={v.cvhId}
                  vehicleId={v.cvhId}
                  plate={v.cvhPlateNumber}
                  model={v.cvhModel}
                  month={month}
                  initial={fixedMap.get(v.cvhId) ?? { salary: 0, depreciation: 0, insurance: 0 }}
                  locked={closed}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
        active
          ? 'bg-accent text-accent-fg border-accent'
          : 'bg-surface text-text-muted border-border hover:border-accent hover:text-accent',
      )}
    >
      {label}
    </Link>
  );
}
