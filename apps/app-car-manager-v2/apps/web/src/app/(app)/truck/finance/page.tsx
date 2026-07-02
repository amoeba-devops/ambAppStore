import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Coins, Download } from 'lucide-react';
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
import { ClickableTableRow } from '@/components/clickable-table-row';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { MonthPicker } from '@/components/inputs/month-picker';
import { FinanceTabs } from './_components/finance-tabs';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import {
  getTruckMonthCloseInfo,
  listTruckFinanceTrips,
} from '@/server/queries/truck-finance.queries';

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
  searchParams: Promise<{ month?: string; vehicle?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : currentMonth();
  const q = sp.q?.trim() || undefined;

  const t = await getTranslations('screens.truckFinance');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const vehicleId = sp.vehicle && trucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  const [rows, pnl, closeInfo] = await Promise.all([
    listTruckFinanceTrips(user.entId, { month, vehicleId, q }),
    computeTruckPnl(user, { vehicleId, months: [month] }),
    getTruckMonthCloseInfo(user.entId, month),
  ]);
  const summary = pnl[0] ?? null;
  const closed = closeInfo.closed;

  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const num = (n: number, frac = 0) => n.toLocaleString(loc, { maximumFractionDigits: frac });
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);

  const qs = q ? `&q=${encodeURIComponent(q)}` : '';
  const chipHref = (v?: string) => `/truck/finance?month=${month}${v ? `&vehicle=${v}` : ''}${qs}`;
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
        {/* Controls: month + status + vehicle chips */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-64" clearLabel={tA('clear')} />
            <MonthPicker value={month} />
            <Badge tone={closed ? 'success' : 'warning'} size="sm">
              {closed ? t('finalized') : t('provisional')}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip href={chipHref()} active={!vehicleId} label={t('allTrucks')} />
            {trucks.map((v) => (
              <Chip key={v.cvhId} href={chipHref(v.cvhId)} active={vehicleId === v.cvhId} label={v.cvhPlateNumber} />
            ))}
          </div>
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
                      <Badge tone={r.finalized ? 'success' : 'warning'} size="sm">
                        {r.finalized ? t('finalized') : t('provisional')}
                      </Badge>
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
