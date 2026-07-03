import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ClipboardList, Download, FileSpreadsheet, Plus, Upload } from 'lucide-react';
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
import { ListRowActions } from '@/components/list-row-actions';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { MonthPicker } from '@/components/inputs/month-picker';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { TripFilters } from './_components/trip-filters';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export default async function TruckTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; region?: string; vehicle?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month : undefined;
  const status = sp.status === 'complete' || sp.status === 'ongoing' ? sp.status : undefined;
  const regionCodes: readonly string[] = TRUCK_REGIONS;
  const region = sp.region && regionCodes.includes(sp.region) ? sp.region : undefined;

  const t = await getTranslations('screens.truckTrips');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const regionLabel = (r: string | null) => (r && regionCodes.includes(r) ? tRegion(r) : (r ?? '—'));

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const vehicle = sp.vehicle && trucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;
  const trips = await listTruckTrips(user.entId, { q, month, region, vehicleId: vehicle, status });
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);
  const plateOptions = trucks.map((v) => ({ id: v.cvhId, label: v.cvhPlateNumber }));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (month) exportParams.set('month', month);
  if (region) exportParams.set('region', region);
  if (vehicle) exportParams.set('vehicle', vehicle);
  if (status) exportParams.set('status', status);
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
              <a href={`${BASE_PATH}/truck/import/template`}>
                <FileSpreadsheet />
                {t('template')}
              </a>
            </Button>
            <Button variant="ghost" size="md" asChild>
              <Link href="/truck/import">
                <Upload />
                {t('importExcel')}
              </Link>
            </Button>
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
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-72" clearLabel={tA('clear')} />
          <MonthPicker value={month ?? ''} />
          <TripFilters plates={plateOptions} region={region} vehicle={vehicle} status={status} />
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
          <>
            {/* Mobile card list — the desktop trip log is ~865px wide (10
             * columns) so it forces horizontal scrolling on phones. Below md
             * each trip renders as a tappable card with date, customer, the
             * key operational fields + a compact cost line. */}
            <ul className="md:hidden space-y-2.5">
              {trips.map((trip) => (
                <li key={trip.trpId}>
                  <Link
                    href={`/truck/trips/${trip.trpId}`}
                    className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-text">{date(trip.scheduledAt)}</div>
                        <div className="text-xs text-text-faint font-mono truncate">{trip.ref}</div>
                      </div>
                      <Badge tone={trip.status === 'COMPLETED' ? 'success' : 'neutral'} size="sm">
                        {trip.status === 'COMPLETED' ? t('statusDone') : t('statusOpen')}
                      </Badge>
                    </div>
                    <div className="mt-1.5 text-sm text-text truncate">
                      {trip.customer ?? '—'}
                      {trip.bol && <span className="text-xs text-text-faint font-mono"> · {trip.bol}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                      <span className="font-mono text-text">{trip.plate ?? '—'}</span>
                      {trip.region && <span>· {regionLabel(trip.region)}</span>}
                      <span>· {trip.driver ?? '—'}</span>
                      <span className="tabular">· {trip.km != null ? `${trip.km.toLocaleString(loc)} km` : '—'}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-text-faint tabular">
                      <span>{t('thFuel')}: {vnd(trip.breakdown.fuelCost)}</span>
                      <span>{t('thToll')}: {vnd(trip.breakdown.tollFee)}</span>
                      <span>{t('thOther')}: {vnd(trip.breakdown.extraTotal)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <Card variant="outline" className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px]">{t('thStt')}</TableHead>
                  <TableHead>{t('thDate')}</TableHead>
                  <TableHead>{t('thVehicle')}</TableHead>
                  <TableHead>{t('thRegion')}</TableHead>
                  <TableHead>{t('thDriver')}</TableHead>
                  <TableHead>{t('thCustomer')}</TableHead>
                  <TableHead className="text-right">{t('thKm')}</TableHead>
                  <TableHead className="text-right">{t('thFuel')}</TableHead>
                  <TableHead className="text-right">{t('thToll')}</TableHead>
                  <TableHead className="text-right">{t('thOther')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                  <TableHead className="w-[88px]">{t('thActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip, i) => (
                  <ClickableTableRow key={trip.trpId} href={`/truck/trips/${trip.trpId}`}>
                    <TableCell className="tabular text-text-faint">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium text-text">{date(trip.scheduledAt)}</div>
                      <div className="text-xs text-text-faint font-mono">{trip.ref}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-text">{trip.plate ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">{regionLabel(trip.region)}</TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">{trip.driver ?? '—'}</TableCell>
                    <TableCell>
                      <div className="text-text">{trip.customer ?? '—'}</div>
                      {trip.bol && <div className="text-xs text-text-faint font-mono">{trip.bol}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular">{trip.km != null ? `${trip.km.toLocaleString(loc)} km` : '—'}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(trip.breakdown.fuelCost)}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(trip.breakdown.tollFee)}</TableCell>
                    <TableCell className="text-right tabular text-text-muted">{vnd(trip.breakdown.extraTotal)}</TableCell>
                    <TableCell>
                      <Badge tone={trip.status === 'COMPLETED' ? 'success' : 'neutral'} size="sm">
                        {trip.status === 'COMPLETED' ? t('statusDone') : t('statusOpen')}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-text-faint tabular">
                      {trip.updatedAt ? date(trip.updatedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <ListRowActions
                        editHref={`/truck/trips/${trip.trpId}/edit`}
                        deleteId={trip.trpId}
                        kind="trip"
                        confirmText={t('deleteConfirm')}
                      />
                    </TableCell>
                  </ClickableTableRow>
                ))}
              </TableBody>
            </Table>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
