import { getLocale, getTranslations } from 'next-intl/server';
import { Coins, Download, Info } from 'lucide-react';
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
import { ParamMultiSelect } from '@/components/inputs/param-multi-select';
import { FinanceTabs } from './_components/finance-tabs';
import { GenerateAllRegionsButton } from './_components/generate-all-regions-button';
import { PageHeader } from '@/components/layout/page-header';
import { RegionDeniedNotice } from '@/components/truck/region-denied-notice';
import { ReportStatusBadge } from '@/components/truck/report-status-badge';
import { FuelReconciliationBadge } from '@/components/truck/fuel-reconciliation-badge';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { resolveRegionFilter, resolveVehicleScope } from '@/lib/auth/region-access';
import {
  getTruckFixedCostsLastUpdated,
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
  searchParams: Promise<{
    month?: string;
    /** CSV multi-select (REQ-20260814); `vehicle` kept for older links. */
    vehicles?: string;
    vehicle?: string;
    q?: string;
    region?: string;
    region_denied?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();
  const q = sp.q?.trim() || undefined;
  /* Region ACL (REQ-20260813) — validated ?region= + the set this user may see. */
  const { region, regions: permittedRegions } = await resolveRegionFilter(user, sp.region, sp);
  const restricted = permittedRegions.length < TRUCK_REGIONS.length;
  const scopeRegions = restricted ? permittedRegions : undefined;

  const t = await getTranslations('screens.truckFinance');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);

  /* Vehicle multi-select (REQ-20260814) — `trucks` is already region-scoped and
   * ids outside it are dropped; `vehicleIds` is undefined for "all trucks". */
  const { trucks, vehicleIds } = await resolveVehicleScope(user, sp.vehicles ?? sp.vehicle);

  const [rows, pnl, latestReport, fixedUpdatedAt] = await Promise.all([
    listTruckFinanceTrips(user.entId, { month, vehicleIds, q, region, regions: scopeRegions }),
    computeTruckPnl(user, { vehicleIds, region, regions: scopeRegions, months: [month] }),
    getLatestTruckReportForMonth(user.entId, month, region),
    getTruckFixedCostsLastUpdated(user.entId, month),
  ]);
  const summary = pnl[0] ?? null;

  /* Regions that still have provisional trips — the scope the targeted
   * "Lập báo cáo khu vực còn tạm tính" action reports on. The explanatory
   * banner that used to list them was removed (user request 2026-08-18); the
   * per-trip "Tạm tính" badge in the table already carries that information,
   * so only the action itself is kept, on the page header. */
  const provByRegion = new Set<string>();
  for (const r of rows) {
    if (!r.finalized && r.region) provByRegion.add(r.region);
  }
  const provisionalRegionCodes = [...provByRegion];
  /* Two report-generation scopes offered in the header: targeted (only the
   * still-provisional regions — leaves already-reported regions untouched)
   * and full refresh (every region with trip data, including ones already
   * reported, recomputed from the current live data). Trips on a vehicle with
   * no region can't be targeted by either — there's no region to scope to. */
  const canReport = user.role === 'ADMIN' || user.role === 'MANAGER';
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
  /* `region` now travels to the export too — the route enforces the ACL either
   * way, but without it the file ignored the filter the screen is showing. */
  const exportHref =
    `${BASE_PATH}/truck/finance/export?month=${month}` +
    `${vehicleIds ? `&vehicles=${vehicleIds.join(',')}` : ''}` +
    `${region ? `&region=${region}` : ''}${qs}`;

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
          <div className="flex flex-wrap items-center gap-2">
            {canReport && provisionalRegionCodes.length > 0 && (
              <GenerateAllRegionsButton
                month={month}
                regions={provisionalRegionCodes}
                label={t('genProvisionalBtn')}
              />
            )}
            {canReport && rows.length > 0 && (
              <GenerateAllRegionsButton month={month} label={t('genAllBtn')} variant="secondary" />
            )}
            {rows.length > 0 && (
              <Button variant="ghost" size="md" asChild>
                <a href={exportHref}>
                  <Download />
                  {t('export')}
                </a>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <RegionDeniedNotice code={sp.region_denied} />
        <FinanceTabs active="trips" month={month} vehicleIds={vehicleIds} />
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
          <ParamMultiSelect
            param="vehicles"
            values={vehicleIds ?? []}
            allLabel={t('allTrucks')}
            buttonLabel={
              vehicleIds ? t('vehicleFilterN', { n: vehicleIds.length }) : t('allTrucks')
            }
            title={t('vehicleFilterTitle')}
            applyLabel={t('vehicleFilterApply')}
            clearLabel={t('vehicleFilterClear')}
            options={trucks.map((v) => ({
              value: v.cvhId,
              label: v.cvhPlateNumber,
              hint: v.cvhRegion ? tRegion(v.cvhRegion as 'HCM') : undefined,
            }))}
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
