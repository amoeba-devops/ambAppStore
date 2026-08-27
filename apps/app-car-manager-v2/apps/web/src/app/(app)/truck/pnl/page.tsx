import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { Button, Card, cn } from '@car-v2/ui';
import { computeTruckPnl, type TruckPnlRow } from '@car-v2/core/truck';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { PageHeader } from '@/components/layout/page-header';
import { RegionDeniedNotice } from '@/components/truck/region-denied-notice';
import { MonthPicker } from '@/components/inputs/month-picker';
import { ParamSelect } from '@/components/inputs/param-select';
import { ParamMultiSelect } from '@/components/inputs/param-multi-select';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { resolveRegionFilter, resolveVehicleScope } from '@/lib/auth/region-access';
import { getTruckReportStatus } from '@/server/queries/truck-report.queries';
import {
  getTruckFuelStats,
  isTruckMonthClosed,
  listFuelInvoices,
} from '@/server/queries/truck-finance.queries';
import { ReportStatusBadge } from '@/components/truck/report-status-badge';
import { FuelReconciliationBadge, aggregateFuelMode } from '@/components/truck/fuel-reconciliation-badge';
import { FinanceTabs } from '../finance/_components/finance-tabs';
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
  { key: 'fixedCost', labelKey: 'fixed', kind: 'subtotal' },
  { key: 'tripCount', labelKey: 'trips', kind: 'count' },
  { key: 'netProfit', labelKey: 'netProfit', kind: 'profit' },
];

export default async function TruckPnlPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** CSV multi-select (REQ-20260814); `vehicle` kept for older links. */
    vehicles?: string;
    vehicle?: string;
    month?: string;
    region?: string;
    region_denied?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();
  /* Region ACL (REQ-20260813) — validated ?region= + the set this user may see. */
  const { region, regions: permittedRegions } = await resolveRegionFilter(user, sp.region, sp);
  const restricted = permittedRegions.length < TRUCK_REGIONS.length;

  const t = await getTranslations('screens.truckPnl');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  /* Vehicle picker labels are shared with the Chuyến đi tab (one filter, two tabs). */
  const tFinance = await getTranslations('screens.truckFinance');
  const locale = await getLocale();
  const loc = bcp47(locale);

  /* Vehicle multi-select (REQ-20260814) — region-scoped list + validated ids. */
  const { trucks, vehicleIds } = await resolveVehicleScope(user, sp.vehicles ?? sp.vehicle);

  const months = threeMonthsEnding(month);
  const [rows, monthStatuses, invoices, fuelStats, regionLocked] = await Promise.all([
    computeTruckPnl(user, {
      vehicleIds,
      region,
      regions: restricted ? permittedRegions : undefined,
      months,
    }),
    /* Per-month, REGION-SCOPED report status (when was it generated, is it
     * stale) — one source shared with Finance/Dashboard/chi tiết chuyến. */
    Promise.all(months.map((m) => getTruckReportStatus(user.entId, m, region ?? null))),
    /* Fuel-invoice ledger — the data source of the report's fuel reconciliation
     * (avg price + consumption). Region-scoped, so it needs a region selected. */
    region ? listFuelInvoices(user.entId, month, region) : Promise.resolve(null),
    region ? getTruckFuelStats(user.entId, month, region) : Promise.resolve(null),
    /* Legacy manual closes still lock their months; reports don't. */
    region ? isTruckMonthClosed(user.entId, month, region) : Promise.resolve(false),
  ]);

  const unreportedMonths = months.filter((m, i) => monthStatuses[i]!.reportedAt == null);
  const selected = rows.find((r) => r.month === month) ?? null;

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const monthLabel = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(loc, { month: 'short', year: '2-digit' });
  const fmt = (def: MetricDef, n: number) => (def.kind === 'count' ? n.toLocaleString(loc) : vnd(n));

  const rq = region ? `&region=${region}` : '';
  /* Export links carry the vehicle scope too — until REQ-20260814 they dropped
   * it, so the file never matched the filter on screen. */
  const vq = vehicleIds ? `&vehicles=${vehicleIds.join(',')}` : '';

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckPnl') }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" asChild>
              <a href={`${BASE_PATH}/truck/pnl/export?month=${month}&format=xlsx${rq}${vq}`}>
                <Download />
                Excel
              </a>
            </Button>
            <Button variant="ghost" size="md" asChild>
              <a href={`${BASE_PATH}/truck/pnl/export?month=${month}&format=pdf${rq}${vq}`}>
                <FileText />
                PDF
              </a>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-5">
        <RegionDeniedNotice code={sp.region_denied} />
        {/* Month + tab bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <MonthPicker value={month} />
            <ParamSelect
              param="region"
              value={region}
              allLabel={t('allRegions')}
              options={permittedRegions.map((r) => ({ value: r, label: tRegion(r) }))}
            />
          </div>
          <FinanceTabs active="overview" month={month} vehicleIds={vehicleIds} />
        </div>

        {/* Report status banner */}
        {unreportedMonths.length > 0 && (
          <Card variant="outline" className="flex flex-wrap items-center gap-3 border-warning/40 bg-warning/5 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <span className="flex-1 text-sm text-text">{t('unreportedBanner')}</span>
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
                [
                  t('fuel'),
                  <>
                    {vnd(selected.fuelCost)}
                    <FuelReconciliationBadge
                      mode={aggregateFuelMode({
                        averaged: selected.fuelAveragedTripCount,
                        live: selected.fuelLiveTripCount,
                        unset: selected.fuelUnsetTripCount,
                      })}
                    />
                  </>,
                ],
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
                /* Fixed cost = driver salary + depreciation (insurance dropped
                 * from the model 2026-07-21); rows sum to the total. */
                [t('salary'), vnd(selected.salary)],
                [t('depreciation'), vnd(selected.depreciation)],
              ]}
            />
          </div>
        )}

        {/* P&L table */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ParamMultiSelect
              param="vehicles"
              values={vehicleIds ?? []}
              allLabel={t('allTrucks')}
              buttonLabel={
                vehicleIds ? tFinance('vehicleFilterN', { n: vehicleIds.length }) : t('allTrucks')
              }
              title={tFinance('vehicleFilterTitle')}
              applyLabel={tFinance('vehicleFilterApply')}
              clearLabel={tFinance('vehicleFilterClear')}
              options={trucks.map((v) => ({
                value: v.cvhId,
                label: v.cvhPlateNumber,
                hint: v.cvhRegion ? tRegion(v.cvhRegion as 'HCM') : undefined,
              }))}
            />
          </div>

          <Card variant="outline" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-semibold text-text-muted px-4 py-2.5">{t('metric')}</th>
                  {months.map((m, i) => (
                    <th key={m} className="text-right font-semibold text-text-muted px-4 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <span>{monthLabel(m)}</span>
                        <ReportStatusBadge reportedAt={monthStatuses[i]!.reportedAt} stale={monthStatuses[i]!.stale} locale={locale} />
                      </div>
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
                          {def.key === 'fuelCost' ? (
                            <div className="flex flex-col items-end gap-1">
                              <span>{fmt(def, n)}</span>
                              <FuelReconciliationBadge
                                mode={aggregateFuelMode({
                                  averaged: row.fuelAveragedTripCount,
                                  live: row.fuelLiveTripCount,
                                  unset: row.fuelUnsetTripCount,
                                })}
                              />
                            </div>
                          ) : (
                            fmt(def, n)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Fuel-invoice ledger — the input of the report's fuel reconciliation
         * (giá bình quân + định mức). Region-scoped; the reconciliation itself
         * is frozen per report by "Lập báo cáo" (PLAN-20260707). */}
        {region && invoices ? (
          <div className="space-y-3">
            {fuelStats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    [t('avgPrice'), `${fuelStats.avgPrice.toLocaleString(loc)} ₫/L`],
                    [t('consumption'), `${fuelStats.consumption.toFixed(3)} L/km`],
                    [t('invoiceLiters'), `${fuelStats.invoiceLiters.toLocaleString(loc)} L`],
                    [t('totalKm'), `${fuelStats.totalKm.toLocaleString(loc)} km`],
                  ] as const
                ).map(([label, value]) => (
                  <Card key={label} variant="outline" className="p-3">
                    <div className="text-xs text-text-muted">{label}</div>
                    <div className="mt-1 text-sm font-bold tabular text-text">{value}</div>
                  </Card>
                ))}
              </div>
            )}
            <FuelInvoicePanel
              month={month}
              region={region}
              invoices={invoices}
              /* Only this region's trucks — an invoice belongs to one of them. */
              vehicles={trucks
                .filter((v) => v.cvhRegion === region)
                .map((v) => ({ id: v.cvhId, plate: v.cvhPlateNumber }))}
              locked={regionLocked}
            />
            <p className="text-xs text-text-faint">{t('monthEndFormula')}</p>
          </div>
        ) : (
          <Card variant="outline" className="p-4 text-sm text-text-muted">{t('invoiceRegionHint')}</Card>
        )}
      </div>
    </>
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
  rows: [string, React.ReactNode][];
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
            <span className="tabular text-text inline-flex items-center gap-1.5">{value}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-faint">{hint}</p>
    </Card>
  );
}

