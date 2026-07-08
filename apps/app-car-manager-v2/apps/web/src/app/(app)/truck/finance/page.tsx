import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Coins, Download } from 'lucide-react';
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
import { PageHeader } from '@/components/layout/page-header';
import { ReportStatusBadge } from '@/components/truck/report-status-badge';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import {
  getTruckFixedCostsLastUpdated,
  getTruckFuelStats,
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
  searchParams: Promise<{ month?: string; vehicle?: string; q?: string; region?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();
  const q = sp.q?.trim() || undefined;
  const regionCodes: readonly string[] = TRUCK_REGIONS;
  const region = sp.region && regionCodes.includes(sp.region) ? sp.region : undefined;

  const t = await getTranslations('screens.truckFinance');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const vehicleId = sp.vehicle && trucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  const [rows, pnl, latestReport, fixedUpdatedAt, fuelStats] = await Promise.all([
    listTruckFinanceTrips(user.entId, { month, vehicleId, q, region }),
    computeTruckPnl(user, { vehicleId, region, months: [month] }),
    getLatestTruckReportForMonth(user.entId, month, region),
    getTruckFixedCostsLastUpdated(user.entId, month),
    getTruckFuelStats(user.entId, month, region),
  ]);
  const summary = pnl[0] ?? null;

  /* Transparency (feedback #1): per-trip profit falls back to the manually
   * entered fuel price until a report freezes a valid month-end snapshot — and
   * that snapshot needs BOTH odometer km (Σ > 0) and fuel invoices. When any
   * row is still provisional, surface exactly what's missing so the operator
   * knows why the "bình quân xăng" isn't applied yet (instead of silently
   * showing raw numbers under a green "Đã lập BC" badge). */
  const provisionalCount = rows.filter((r) => !r.finalized).length;
  const kmZeroCount = rows.filter((r) => r.km <= 0).length;
  const hasInvoice = fuelStats.invoiceLiters > 0 && fuelStats.avgPrice > 0;
  const allocatable = fuelStats.totalKm > 0 && hasInvoice;
  const showProvNotice = provisionalCount > 0;
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

  const summaryCards: [string, number, ('profit' | 'plain')?][] = summary
    ? [
        [t('sumRevenue'), summary.revenue],
        [t('sumFuel'), summary.fuelCost],
        [t('sumToll'), summary.tollFee],
        [t('sumOther'), summary.extraTotal],
        [t('sumDriverSalary'), summary.driverSalary],
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
        <FinanceTabs active="trips" month={month} vehicleId={vehicleId} />
        {/* Controls: search + month + region + vehicle (dropdown, left-aligned — Sheet-2 P5) */}
        <div className="flex flex-wrap items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-64" clearLabel={tA('clear')} />
          <MonthPicker value={month} />
          <ParamSelect
            param="region"
            value={region}
            allLabel={t('allRegions')}
            options={regionCodes.map((r) => ({ value: r, label: tRegion(r) }))}
          />
          <ParamSelect
            param="vehicle"
            value={vehicleId}
            allLabel={t('allTrucks')}
            options={trucks.map((v) => ({ value: v.cvhId, label: v.cvhPlateNumber }))}
          />
          <ReportStatusBadge reportedAt={latestReport?.createdAt ?? null} stale={stale} locale={locale} />
        </div>

        {/* Month summary cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {summaryCards.map(([label, value, kind]) => (
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
                  {kmZeroCount > 0 && <li>{t('provKm', { count: kmZeroCount })}</li>}
                  {!hasInvoice && <li>{t('provInvoice')}</li>}
                  {allocatable && <li>{t('provReady')}</li>}
                </ul>
                <a
                  href={`${BASE_PATH}/truck/pnl?month=${month}${region ? `&region=${region}` : ''}`}
                  className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                >
                  {t('provCta')} →
                </a>
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
                  <TableHead className="text-right">{t('thFuel')}</TableHead>
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
                    <TableCell className={cn('text-right tabular', !r.finalized && 'text-text-faint italic')}>
                      {vnd(r.unitPrice)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular', !r.finalized && 'text-text-faint italic')}>
                      {num(r.liters, 1)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular', !r.finalized && 'text-text-faint italic')}>
                      {vnd(r.fuelCost)}
                    </TableCell>
                    <TableCell className="text-right tabular">{vnd(r.revenue)}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular font-semibold',
                        r.profit >= 0 ? 'text-success' : 'text-danger',
                        !r.finalized && 'italic',
                      )}
                    >
                      {vnd(r.profit)}
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
