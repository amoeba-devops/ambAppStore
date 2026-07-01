import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AlertTriangle, Download, FileText, History } from 'lucide-react';
import { Button, Card, cn } from '@car-v2/ui';
import { computeTruckPnl, type TruckPnlRow } from '@car-v2/core/truck';
import { PageHeader } from '@/components/layout/page-header';
import { MonthPicker } from '@/components/inputs/month-picker';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { getTruckFixedCostsByMonth } from '@/server/queries/truck-fixed-cost.queries';
import {
  getClosedTruckMonths,
  getTruckMonthCloseInfo,
  getTruckFuelStats,
  getTruckRegionCloseStates,
  listFuelInvoices,
  listTruckMonthAdjustments,
} from '@/server/queries/truck-finance.queries';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { TruckFixedCostRow } from '../settings/_components/truck-fixed-cost-row';
import { FinanceTabs } from '../finance/_components/finance-tabs';
import { MonthCloseControls } from './_components/month-close-controls';
import { FuelInvoicePanel } from './_components/fuel-invoice-panel';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
  searchParams: Promise<{ vehicle?: string; month?: string; tab?: string; region?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();
  const tab = sp.tab === 'invoices' ? 'invoices' : 'overview';
  /* Region scope for the chốt-sổ tab (REQ-20260630). Defaults to the first
   * region; close + fuel reconciliation + invoices are all scoped to it. */
  const region =
    sp.region && (TRUCK_REGIONS as readonly string[]).includes(sp.region) ? sp.region : TRUCK_REGIONS[0];

  const t = await getTranslations('screens.truckPnl');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const vehicleId = sp.vehicle && trucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  const months = threeMonthsEnding(month);
  const [rows, closeInfo, closedSet, fixedMap, invoices, liveStats, adjustments, regionStates] =
    await Promise.all([
      computeTruckPnl(user, { vehicleId, months }),
      getTruckMonthCloseInfo(user.entId, month, region),
      getClosedTruckMonths(user.entId, months),
      getTruckFixedCostsByMonth(user.entId, month),
      listFuelInvoices(user.entId, month, region),
      getTruckFuelStats(user.entId, month, region),
      listTruckMonthAdjustments(user.entId, month, region),
      getTruckRegionCloseStates(user.entId, month),
    ]);

  const closed = closeInfo.closed;
  const isAdmin = user.role === 'ADMIN';
  /* Closed → show the frozen snapshot; open → the live preview. */
  const snapshot =
    closed && closeInfo.snapshot
      ? closeInfo.snapshot
      : {
          avgPrice: liveStats.avgPrice,
          consumption: liveStats.consumption,
          totalLiters: liveStats.invoiceLiters,
          totalKm: liveStats.totalKm,
        };
  const openMonths = months.filter((m) => !closedSet.has(m));
  const selected = rows.find((r) => r.month === month) ?? null;
  /* Fixed-cost rows for the selected region's trucks (chốt-sổ tab). */
  const regionTrucks = trucks.filter((v) => v.cvhRegion === region);

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const monthLabel = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short', year: '2-digit' });
  const fmt = (def: MetricDef, n: number) => (def.kind === 'count' ? n.toLocaleString(loc) : vnd(n));

  const withParams = (next: { tab?: string; vehicle?: string | null; region?: string }) => {
    const t2 = next.tab ?? tab;
    const v = next.vehicle === undefined ? vehicleId : next.vehicle ?? undefined;
    const r = next.region ?? region;
    return `/truck/pnl?month=${month}&tab=${t2}&region=${r}${v ? `&vehicle=${v}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckPnl') }]}
        actions={
          tab === 'overview' ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="md" asChild>
                <a href={`${BASE_PATH}/truck/pnl/export?month=${month}&format=xlsx`}>
                  <Download />
                  Excel
                </a>
              </Button>
              <Button variant="ghost" size="md" asChild>
                <a href={`${BASE_PATH}/truck/pnl/export?month=${month}&format=pdf`}>
                  <FileText />
                  PDF
                </a>
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        {/* Month + tab bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-muted">{t('monthLabel')}</span>
            <MonthPicker value={month} />
          </div>
          <FinanceTabs active={tab} month={month} vehicleId={vehicleId} />
        </div>

        {tab === 'overview' ? (
          <>
            {/* Provisional banner — any month in the window still open. */}
            {openMonths.length > 0 && (
              <Card variant="outline" className="flex flex-wrap items-center gap-3 border-warning/40 bg-warning/5 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <span className="flex-1 text-sm text-text">{t('provisionalBanner')}</span>
                <Link
                  href={withParams({ tab: 'invoices' })}
                  className="text-sm font-semibold text-accent hover:underline shrink-0"
                >
                  {t('goCloseMonth')}
                </Link>
              </Card>
            )}

            {/* Variable vs fixed split for the selected month. */}
            {selected && (
              <div className="grid gap-3 sm:grid-cols-2">
                <CostCard
                  tone="variable"
                  title={t('variableTitle')}
                  total={vnd(selected.variableCost)}
                  hint={t('variableHint')}
                  rows={[
                    [t('fuel'), vnd(selected.fuelCost)],
                    [t('toll'), vnd(selected.tollFee)],
                    [t('other'), vnd(selected.extraTotal)],
                  ]}
                />
                <CostCard
                  tone="fixed"
                  title={t('fixedTitle')}
                  total={vnd(selected.fixedCost)}
                  hint={t('fixedHint')}
                  rows={[
                    [t('salary'), vnd(selected.salary)],
                    [t('depreciation'), vnd(selected.depreciation)],
                    [t('insurance'), vnd(selected.insurance)],
                    [t('driverSalary'), vnd(selected.driverSalary)],
                  ]}
                />
              </div>
            )}

            {/* P&L table */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip href={withParams({ vehicle: null })} active={!vehicleId} label={t('allTrucks')} />
                {trucks.map((v) => (
                  <Chip key={v.cvhId} href={withParams({ vehicle: v.cvhId })} active={vehicleId === v.cvhId} label={v.cvhPlateNumber} />
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
          </>
        ) : (
          <>
            {/* Region selector + per-region close status (REQ-20260630). */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text-muted">{t('regionLabel')}</span>
                {TRUCK_REGIONS.map((r) => (
                  <Chip key={r} href={withParams({ region: r })} active={region === r} label={tRegion(r)} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {regionStates.map((rs) => (
                  <span
                    key={rs.region}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                      rs.closed ? 'border-success/40 bg-success/5 text-success' : 'border-border text-text-muted',
                    )}
                  >
                    {tRegion(rs.region)} · {rs.closed ? t('statusClosed') : t('statusOpen')}
                  </span>
                ))}
              </div>
            </div>

            {/* Close / reopen for the selected region */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-text">{t('closeRegionTitle', { region: tRegion(region) })}</h2>
              <MonthCloseControls month={month} region={region} closed={closed} canReopen={isAdmin} />
            </div>

            {/* Month-end computation snapshot */}
            <Card variant="outline" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text">{t('monthEndTitle')}</h2>
                <span className="text-xs text-text-muted">
                  {closed ? t('statusClosed') : t('statusOpen')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label={t('invoiceLiters')} value={`${snapshot.totalLiters.toLocaleString(loc)} L`} />
                <Stat label={t('totalKm')} value={`${snapshot.totalKm.toLocaleString(loc)} km`} />
                <Stat label={t('avgPrice')} value={vnd(snapshot.avgPrice)} />
                <Stat label={t('consumption')} value={`${snapshot.consumption.toFixed(3)} L/km`} />
                <Stat label={t('totalFuel')} value={vnd(Math.round(snapshot.totalLiters * snapshot.avgPrice))} />
              </div>
              <p className="text-xs text-text-faint">{t('monthEndFormula')}</p>
            </Card>

            {/* Fuel-invoice ledger for the selected month × region */}
            <FuelInvoicePanel month={month} region={region} invoices={invoices} locked={closed} />

            {/* Fixed costs for the selected month */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-text">{t('fixedCostsTitle', { month })}</h2>
              {regionTrucks.length === 0 ? (
                <Card variant="outline" className="p-6 text-center text-sm text-text-muted">{t('noTrucks')}</Card>
              ) : (
                <div className="space-y-3">
                  {regionTrucks.map((v) => (
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

            {/* Adjustment history (reopen log) */}
            {adjustments.length > 0 && (
              <Card variant="outline" className="p-4 space-y-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
                  <History className="h-4 w-4 text-text-muted" />
                  {t('adjustmentHistory')}
                </h2>
                <ul className="space-y-2">
                  {adjustments.map((a, i) => (
                    <li key={i} className="rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm">
                      <div className="text-text">{t('reopenedEntry')}</div>
                      <div className="text-text-muted">{t('reasonLabel')}: {a.reason}</div>
                      {a.reopenedAt && (
                        <div className="text-xs text-text-faint tabular">
                          {new Date(a.reopenedAt).toLocaleString(loc)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center min-h-[44px] md:min-h-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
        active
          ? 'bg-accent text-accent-fg border-accent'
          : 'bg-surface text-text-muted border-border hover:border-accent hover:text-accent',
      )}
    >
      {label}
    </Link>
  );
}

function CostCard({
  tone,
  title,
  total,
  hint,
  rows,
}: {
  tone: 'variable' | 'fixed';
  title: string;
  total: string;
  hint: string;
  rows: [string, string][];
}) {
  return (
    <Card variant="outline" className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-sm', tone === 'variable' ? 'bg-accent' : 'bg-text-muted')} />
        <span className="text-sm font-semibold text-text">{title}</span>
      </div>
      <div className="text-lg font-bold tabular text-text">{total}</div>
      <ul className="space-y-1 border-t border-border pt-2">
        {rows.map(([label, value]) => (
          <li key={label} className="flex justify-between text-sm">
            <span className="text-text-muted">{label}</span>
            <span className="tabular text-text">{value}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-faint">{hint}</p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="font-semibold text-text tabular text-sm">{value}</div>
    </div>
  );
}
