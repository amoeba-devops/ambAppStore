import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ClipboardList, Download, Plus } from 'lucide-react';
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
} from '@car-v2/ui';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { MonthPicker } from '@/components/inputs/month-picker';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export default async function TruckTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month : undefined;

  const t = await getTranslations('screens.truckTrips');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();

  const trips = await listTruckTrips(user.entId, { q, month });
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);

  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (month) exportParams.set('month', month);
  const exportHref = `${BASE_PATH}/truck/trips/export${exportParams.toString() ? `?${exportParams}` : ''}`;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: trips.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckTrips') }]}
        actions={
          <>
            <Button variant="ghost" size="md" asChild>
              <a href={exportHref}>
                <Download />
                {t('export')}
              </a>
            </Button>
            <Button variant="accent" size="md" asChild>
              <Link href="/truck/trips/new">
                <Plus />
                {t('addTrip')}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-72" clearLabel={tA('clear')} />
          <MonthPicker value={month ?? ''} />
        </div>
        {trips.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList />}
              title={t('emptyTitle')}
              description={t('emptyDesc')}
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/truck/trips/new">
                    <Plus />
                    {t('addTrip')}
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <Card variant="outline" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thDate')}</TableHead>
                  <TableHead>{t('thCustomer')}</TableHead>
                  <TableHead className="text-right">{t('thKm')}</TableHead>
                  <TableHead className="text-right">{t('thFuel')}</TableHead>
                  <TableHead className="text-right">{t('thOther')}</TableHead>
                  <TableHead className="text-right">{t('thRevenue')}</TableHead>
                  <TableHead className="text-right">{t('thProfit')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <ClickableTableRow key={trip.trpId} href={`/truck/trips/${trip.trpId}`}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium text-text">{date(trip.scheduledAt)}</div>
                      <div className="text-xs text-text-faint font-mono">{trip.ref}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-text">{trip.customer ?? '—'}</div>
                      {trip.bol && <div className="text-xs text-text-faint font-mono">{trip.bol}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular">{trip.km != null ? `${trip.km.toLocaleString(loc)} km` : '—'}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(trip.breakdown.fuelCost)}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(trip.breakdown.extraTotal)}</TableCell>
                    <TableCell className="text-right tabular">{vnd(trip.breakdown.revenue)}</TableCell>
                    <TableCell className={'text-right tabular font-semibold ' + (trip.breakdown.profit >= 0 ? 'text-success' : 'text-danger')}>
                      {vnd(trip.breakdown.profit)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={trip.status === 'COMPLETED' ? 'success' : 'neutral'} size="sm">
                        {trip.status === 'COMPLETED' ? t('statusDone') : t('statusOpen')}
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
