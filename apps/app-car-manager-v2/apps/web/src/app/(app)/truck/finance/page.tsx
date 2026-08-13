import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Coins, Download, Info } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@car-v2/ui';
import { computeTruckPnl } from '@car-v2/core/truck';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { DateTimeCell } from '@/components/datetime-cell';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { MonthPicker } from '@/components/inputs/month-picker';
import { ParamSelect } from '@/components/inputs/param-select';
import { FinanceTabs } from './_components/finance-tabs';
import { GenerateAllRegionsButton } from './_components/generate-all-regions-button';
import { PageHeader } from '@/components/layout/page-header';
import { RegionDeniedNotice } from '@/components/truck/region-denied-notice';
import { ReportStatusBadge } from '@/components/truck/report-status-badge';
import { FuelReconciliationBadge } from '@/components/truck/fuel-reconciliation-badge';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { resolveRegionFilter } from '@/lib/auth/region-access';
import { listVehicles } from '@/server/queries/vehicles.queries';
import {
  getTruckFixedCostsLastUpdated,
  getTruckInvoiceRegions,
  listTruckFinanceTrips,
} from '@/server/queries/truck-finance.queries';
import { getLatestTruckReportForMonth } from '@/server/queries/truck-report.queries';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function TruckFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; vehicle?: string; q?: string; region?: string; region_denied?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();
  const q = sp.q?.trim() || undefined;
  /* Region ACL (REQ-20260813) — validated ?region= + the set this user may see. */
  const { region, regions: permittedRegions } = await resolveRegionFilter(user, sp.region, sp);
  const restricted = permittedRegions.length < TRUCK_REGIONS.length;
  const permittedCodes: readonly string[] = permittedRegions;
  const scopeRegions = restricted ? permittedRegions : undefined;

  const t = await getTranslations('screens.truckFinance');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const allTrucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const trucks = restricted
    ? allTrucks.filter((v) => v.cvhRegion !== null && permittedCodes.includes(v.cvhRegion))
    : allTrucks;
  const vehicleId = sp.vehicle && trucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  const [rows, pnl, latestReport, fixedUpdatedAt, allInvoiceRegions] = await Promise.all([
    listTruckFinanceTrips(user.entId, { month, vehicleId, q, region, regions: scopeRegions }),
    computeTruckPnl(user, { vehicleId, region, regions: scopeRegions, months: [month] }),
    getLatestTruckReportForMonth(user.entId, month, region),
    getTruckFixedCostsLastUpdated(user.entId, month),
    getTruckInvoiceRegions(user.entId, month),
  ]);
  /* Don't reveal which other regions have invoices to a narrowed user. */
  const invoiceRegions = restricted
    ? new Set([...allInvoiceRegions].filter((r) => permittedCodes.includes(r)))
    : allInvoiceRegions;
  const summary = pnl[0] ?? null;

  /* Transparency (feedback #1): a per-trip fuel/profit only switches to the
   * month-end "bình quân" once ITS region has a report freezing a valid
   * snapshot. Group the still-provisional trips by region so we can name
   * exactly which regions haven't been reported — and tell apart a region that
   * just needs the report generated (it HAS fuel invoices → computable) from
   * one that can't be reconciled yet (no invoices). This replaces the earlier
   * fleet-level notice that misleadingly said "đã đủ dữ liệu — hãy Lập báo cáo"
   * even after a report had been generated for another region. */
  const provByRegion = new Map<string, number>();
  for (const r of rows) {
    if (r.finalized) continue;
    provByRegion.set(r.region ?? '', (provByRegion.get(r.region ?? '') ?? 0) + 1);
  }
  const provRegions = [...provByRegion.entries()].map(([code, count]) => ({
    code: code || null,
    count,
    hasInvoice: code !== '' && invoiceRegions.has(code),
  }));
  const kmZeroCount = rows.filter((r) => !r.finalized && r.km <= 0).length;
  const showProvNotice = provRegions.length > 0;
  const canReport = user.role === 'ADMIN' || user.role === 'MANAGER';
  /* Two report-generation scopes offered on the banner: targeted (only the
   * still-provisional regions — leaves already-reported regions untouched)
   * and full refresh (every region with trip data, including ones already
   * reported, recomputed from the current live data). Vehicles with no
   * region (code === null) can't be targeted by either — there's no region
   * to scope a report to. */
  const provisionalRegionCodes = provRegions.map((r) => r.code).filter((c): c is string => c != null);
  /* Q1 decision (PLAN-20260707): no month lock — instead flag when trips or
   * fixed costs changed AFTER the latest report, so the operator regenerates. */
  const stale =
    latestReport != null &&
    (rows.some((r) => r.updatedAt != null && r.updatedAt > latestReport.createdAt) ||
      (fixedUpdatedAt != null && fixedUpdatedAt > latestReport.createdAt));

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const num = (n: number, frac = 0) => n.toLocaleString(loc, { maximumFractionDigits: frac });
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);

  const qs = q ? `&q=${encodeURIComponent(q)}` : '';
  const exportHref = `${BASE_PATH}/truck/finance/export?month=${month}${vehicleId ? `&vehicle=${vehicleId}` : ''}${qs}`;

  /* The fuel total can mix ACTUAL spend (allocated from invoices) with an
   * ESTIMATE (vehicle rate, no invoice yet). Never let the two hide inside one
   * number — spell the split out under the KPI so nobody reads an estimate as
   * money already spent. */
  const fuelActual = rows.reduce((s, r) => s + (r.fuelMode === 'AVERAGED' ? r.fuelCost : 0), 0);
  const fuelEstimated = rows.reduce((s, r) => s + (r.fuelMode === 'LIVE' ? r.fuelCost : 0), 0);
  const fuelSplitNote =
    fuelEstimated > 0 && fuelActual > 0
      ? t('kpiFuelSplit', { actual: vnd(fuelActual), est: vnd(fuelEstimated) })
      : undefined;

  const summaryCards: [string, number, ('profit' | 'plain')?, string?][] = summary
    ? [
        [t('sumRevenue'), summary.revenue],
        [t('sumFuel'), summary.fuelCost, undefined, fuelSplitNote],
        [t('sumToll'), summary.tollFee],
        [t('sumOther'), summary.extraTotal],
        /* Driver salary folds into fixedCost now (no separate fleet-roster
         * line) — the fixed-cost total below covers salary + depreciation +
         * insurance. */
        [t('sumFixed'), summary.fixedCost],
        [t('sumNet'), summary.netProfit, 'profit'],
      ]
    : [];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: rows.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckFinance') }]}
        actions={
          rows.length > 0 ? (
            <Button variant="ghost" size="md" asChild>
              <a href={exportHref}>
                <Download />
                {t('export')}
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <RegionDeniedNotice code={sp.region_denied} />
        <FinanceTabs active="trips" month={month} vehicleId={vehicleId} />
        {/* Controls: search + month + region + vehicle (dropdown, left-aligned — Sheet-2 P5) */}
        <div className="flex flex-wrap items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-64" clearLabel={tA('clear')} />
          <MonthPicker value={month} />
          <ParamSelect
            param="region"
            value={region}
            allLabel={t('allRegions')}
            options={permittedRegions.map((r) => ({ value: r, label: tRegion(r) }))}
          />
          <ParamSelect
            param="vehicle"
            value={vehicleId}
            allLabel={t('allTrucks')}
            options={trucks.map((v) => ({ value: v.cvhId, label: v.cvhPlateNumber }))}
          />
          <ReportStatusBadge reportedAt={latestReport?.createdAt ?? null} stale={stale} locale={locale} />
          {/* Once a report exists for this month, give a 1-click path to it —
           * the banner-generate flow doesn't navigate to /truck/reports, so
           * without this the file is only reachable via the sidebar menu. */}
          {latestReport && (
            <a
              href={`${BASE_PATH}/truck/reports?month=${month}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              {t('viewReport')} →
            </a>
          )}
        </div>

        {/* Month summary cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {summaryCards.map(([label, value, kind, note]) => (
              <Card key={label} variant="outline" className="p-3">
                <div className="text-xs text-text-muted">{label}</div>
                <div
                  className={cn(
                    'mt-1 text-sm font-bold tabular',
                    kind === 'profit' ? (value >= 0 ? 'text-success' : 'text-danger') : 'text-text',
                  )}
                >
                  {vnd(value)}
                </div>
                {note && <div className="mt-0.5 text-[11px] leading-tight text-text-faint">{note}</div>}
              </Card>
            ))}
          </div>
        )}

        {showProvNotice && (
          <Card variant="outline" className="border-warning/40 bg-warning/5 p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="flex-1 space-y-1.5 text-sm">
                <p className="font-semibold text-text">{t('provTitle')}</p>
                <p className="text-text-muted">{t('provDesc')}</p>
                <ul className="list-disc space-y-0.5 pl-5 text-text-muted">
                  {provRegions.map((r) => (
                    <li key={r.code ?? '∅'}>
                      <span className="font-medium text-text">
                        {r.code ? tRegion(r.code) : t('provRegionUnassigned')}
                      </span>{' '}
                      — {t('provRegionCount', { count: r.count })}
                      {r.code != null && (
                        <span className={r.hasInvoice ? 'text-text-muted' : 'text-warning'}>
                          {' · '}
                          {r.hasInvoice ? t('provRegionReady') : t('provRegionNoInvoice')}
                        </span>
                      )}
                    </li>
                  ))}
                  {kmZeroCount > 0 && <li>{t('provKm', { count: kmZeroCount })}</li>}
                </ul>
                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  {canReport && provisionalRegionCodes.length > 0 && (
                    <GenerateAllRegionsButton
                      month={month}
                      regions={provisionalRegionCodes}
                      label={t('genProvisionalBtn')}
                    />
                  )}
                  {canReport && (
                    <GenerateAllRegionsButton month={month} label={t('genAllBtn')} variant="secondary" />
                  )}
                  <a
                    href={`${BASE_PATH}/truck/pnl?month=${month}${region ? `&region=${region}` : ''}`}
                    className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    {t('provCta')} →
                  </a>
                </div>
              </div>
            </div>
          </Card>
        )}

        {rows.length === 0 ? (
          <Card>
            <EmptyState icon={<Coins />} title={t('emptyTitle')} description={t('emptyDesc')} />
          </Card>
        ) : (
          <Card variant="outline" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thDate')}</TableHead>
                  <TableHead>{t('thVehicle')}</TableHead>
                  <TableHead>{t('thDriver')}</TableHead>
                  <TableHead>{t('thCustomer')}</TableHead>
                  <TableHead className="text-right">{t('thKm')}</TableHead>
                  <TableHead className="text-right">{t('thToll')}</TableHead>
                  <TableHead className="text-right">{t('thOther')}</TableHead>
                  <TableHead className="text-right">{t('thUnitPrice')}</TableHead>
                  <TableHead className="text-right">{t('thLiters')}</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center justify-end gap-1" title={t('thFuelHint')}>
                      {t('thFuel')}
                      <Info className="h-3.5 w-3.5 text-text-faint" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center justify-end gap-1" title={t('thFixedAllocHint')}>
                      {t('thFixedAlloc')}
                      <Info className="h-3.5 w-3.5 text-text-faint" />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">{t('thRevenue')}</TableHead>
                  <TableHead className="text-right">{t('thProfit')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <ClickableTableRow key={r.trpId} href={`/truck/trips/${r.trpId}`}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium text-text">{date(r.scheduledAt)}</div>
                      <div className="text-xs text-text-faint font-mono">{r.ref}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-text">{r.plate ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">{r.driver ?? '—'}</TableCell>
                    <TableCell className="text-text">{r.customer ?? '—'}</TableCell>
                    <TableCell className="text-right tabular">{num(r.km)} km</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(r.toll)}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(r.extra)}</TableCell>
                    <TableCell className={cn('text-right tabular', r.fuelMode === 'UNSET' && 'text-text-faint italic')}>
                      {vnd(r.unitPrice)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular', r.fuelMode === 'UNSET' && 'text-text-faint italic')}>
                      {num(r.liters, 1)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular', r.fuelMode === 'UNSET' && 'text-text-faint italic')}>
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{vnd(r.fuelCost)}</span>
                        {/* Per-trip arithmetic — makes plain that THIS trip's km
                          * drives the figure (same shape in both fuel modes). */}
                        {r.fuelMode !== 'UNSET' && r.km > 0 && (
                          <span className="text-xs font-normal not-italic text-text-faint whitespace-nowrap">
                            {num(r.km)} km × {vnd(r.fuelCostPerKm)}/km
                          </span>
                        )}
                        <FuelReconciliationBadge mode={r.fuelMode} />
                      </div>
                    </TableCell>
                    {/* Fixed cost allocated to this trip (Sheet3 "phân bổ theo
                      * chuyến") — lương + khấu hao tháng ÷ số chuyến của xe. */}
                    <TableCell className="text-right tabular text-text-muted">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{vnd(r.salaryAllocated + r.depreciationAllocated)}</span>
                        {r.salaryAllocated + r.depreciationAllocated > 0 && (
                          <span className="text-xs text-text-faint whitespace-nowrap">
                            {t('allocSalaryShort')} {vnd(r.salaryAllocated)} · {t('allocDeprShort')}{' '}
                            {vnd(r.depreciationAllocated)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular">{vnd(r.revenue)}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular font-semibold',
                        r.profitAfterFixed >= 0 ? 'text-success' : 'text-danger',
                        !r.finalized && 'italic',
                      )}
                    >
                      {vnd(r.profitAfterFixed)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={r.finalized ? 'success' : 'neutral'} size="sm">
                        {r.finalized ? t('reported') : t('provisional')}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <DateTimeCell value={r.updatedAt} locale={loc} />
                    </TableCell>
                  </ClickableTableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
