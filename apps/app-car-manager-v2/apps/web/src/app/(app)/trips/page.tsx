import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Download, Plus } from 'lucide-react';
import {
  Avatar,
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
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import type { CarTripStatus } from '@car-v2/db/schema';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriverByUserId, listDrivers } from '@/server/queries/drivers.queries';
import { getTrip, listTrips, listTripsForDriver } from '@/server/queries/trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { DriverTripsList } from './_components/driver-trips-list';
import { TripPeekDrawer } from './_components/trip-peek-drawer';

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

function formatWhen(iso: Date, labels: { today: string; tomorrow: string; yesterday: string }): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `${labels.today} · ${time}`;
  if (days === 1) return `${labels.tomorrow} · ${time}`;
  if (days === -1) return `${labels.yesterday} · ${time}`;
  return `${d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} · ${time}`;
}

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    peek?: string;
    highlight?: string;
    q?: string;
    date?: string;
  }>;
}

export default async function TripsListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tA      = await getTranslations('actions');
  const tNav    = await getTranslations('nav');
  const tCo     = await getTranslations('company');
  const tList   = await getTranslations('trips.list');
  const tStatus = await getTranslations('trips.status');
  const tFilter = await getTranslations('filters');
  const tCommon = await getTranslations('common');
  const user = await getCurrentUser();

  /* Driver gets a different list shape entirely (card-only, 2-tab Ongoing/
   * Completed, no role/driver column, no "new" CTA). Branch early so the rest
   * of this function stays the admin/manager-tuned shape. Page chrome
   * (PageHeader + breadcrumbs) stays the same across roles so the desktop
   * layout reads identically — only the content body differs. */
  if (user.role === 'DRIVER') {
    const tDriver = await getTranslations('trips.driver');
    const driver = await getDriverByUserId(user.entId, user.userId);
    const driverTrips = driver
      ? await listTripsForDriver(user.entId, driver.drvId, 100)
      : [];
    return (
      <>
        <PageHeader
          title={tDriver('title')}
          breadcrumbs={[{ label: tCo('tenant') }, { label: tDriver('title') }]}
        />
        <DriverTripsList trips={driverTrips} />
      </>
    );
  }

  /* Default filter = 'pending' — the most actionable view (chuyến chờ phân
   * công hoặc chờ tài xế xác nhận). Admin/Manager landing on /trips usually
   * arrive to triage these. Use "All" filter explicitly when needed. */
  const statusFilter = (sp.status ?? 'pending') as 'all' | 'pending' | 'active' | 'completed';
  const dateRange = (sp.date ?? 'all') as 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'past';
  const searchQ = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page ?? 1));
  const peekId = sp.peek;
  /* Highlight a specific row — set after the user creates or edits a trip
   * and gets redirected back to the list. The CSS animation runs once and
   * fades, so refreshing the page makes it disappear naturally. */
  const highlightId = sp.highlight;

  /* Fetch list + peek-target in parallel. peek lookup is best-effort — if the
   * id is stale or wrong tenant, the drawer just won't render (no error). */
  const [{ items, total, pageSize }, peekTrip] = await Promise.all([
    listTrips({
      entId: user.entId,
      role: user.role,
      userId: user.userId,
      status: statusFilter,
      q: searchQ,
      dateRange,
      page,
    }),
    peekId ? getTrip(user.entId, peekId) : Promise.resolve(null),
  ]);

  /* Drawer needs the same admin context as the full detail page (driver/vehicle
   * lookups + role flags). Compute only when we actually have a peek target
   * and an Admin role — Manager/Driver flows in the drawer don't need lists. */
  let peekDrivers: { id: string; label: string }[] = [];
  let peekVehicles: { id: string; label: string }[] = [];
  const peekIsAssignedDriver = false;
  if (peekTrip) {
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      const [drivers, vehicles] = await Promise.all([
        listDrivers(user.entId),
        listVehicles(user.entId),
      ]);
      peekDrivers = drivers.map((d) => ({
        id: d.drvId,
        label: `${d.user.usrName} — ${d.drvLicenseNumber} (${d.drvLicenseClass})`,
      }));
      peekVehicles = vehicles.map((v) => ({
        id: v.cvhId,
        label: `${v.cvhPlateNumber} — ${v.cvhMake ?? ''} ${v.cvhModel}`.trim(),
      }));
    }
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingTo = Math.min(total, page * pageSize);
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;

  /* Pending listed first since it's now the default landing view. Subtle UX
   * hint: the most actionable tab is also where the cursor naturally rests. */
  const FILTERS: Array<{ key: 'all' | 'pending' | 'active' | 'completed'; label: string }> = [
    { key: 'pending',   label: tFilter('pending') },
    { key: 'all',       label: tFilter('all') },
    { key: 'active',    label: tFilter('active') },
    { key: 'completed', label: tFilter('completed') },
  ];

  const dayLabels = { today: tCommon('today'), tomorrow: tCommon('tomorrow'), yesterday: tCommon('yesterday') };

  /* Export URL preserves current filters (status/q/date) sao cho admin xuất
   * đúng cái họ đang xem. Route handler trả CSV ent-scoped. */
  const exportHref = (() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'pending') params.set('status', statusFilter);
    if (searchQ) params.set('q', searchQ);
    if (dateRange !== 'all') params.set('date', dateRange);
    const qs = params.toString();
    return qs ? `/api/v1/trips/export?${qs}` : '/api/v1/trips/export';
  })();

  return (
    <>
      <PageHeader
        title={tNav('trips')}
        subtitle={tList('subtitle', { count: total, role: user.role })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('trips') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />} asChild>
              <a href={exportHref} download>{tA('export')}</a>
            </Button>
            <Button variant="accent" size="md" asChild>
              <Link href="/trips/new"><Plus />{tA('new')}</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto">
            <div className="inline-flex items-center gap-1 rounded-md bg-surface-2 p-1">
              {FILTERS.map((f) => {
                const active = statusFilter === f.key;
                /* Khi đổi status, GIỮ các filter khác (q, date). */
                const href = buildTripsHref({
                  status: f.key,
                  q: searchQ,
                  date: dateRange,
                });
                return (
                  <Link
                    key={f.key}
                    href={href}
                    className={
                      'inline-flex items-center gap-2 h-8 px-3 rounded text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                      (active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text')
                    }
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
            {/* Debounced search — tự cập nhật URL `?q=` sau 300ms, preserve các
             *  param khác (status, date). Server đọc qua searchParams.q. */}
            <DebouncedSearchInput
              placeholder={tList('searchPlaceholder')}
              className="flex-1 md:w-72 md:flex-initial"
              clearLabel={tA('clear')}
            />
            {/* Date range chips */}
            <div className="hidden md:inline-flex items-center gap-1 rounded-md bg-surface-2 p-1">
              {(
                [
                  { key: 'all' as const,       label: tFilter('all') },
                  { key: 'today' as const,     label: tCommon('today') },
                  { key: 'thisWeek' as const,  label: tList('thisWeek') },
                  { key: 'thisMonth' as const, label: tList('thisMonth') },
                ]
              ).map((d) => {
                const active = dateRange === d.key;
                const href = buildTripsHref({ status: statusFilter, q: searchQ, date: d.key });
                return (
                  <Link
                    key={d.key}
                    href={href}
                    className={
                      'inline-flex items-center h-7 px-2.5 rounded text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                      (active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text')
                    }
                  >
                    {d.label}
                  </Link>
                );
              })}
            </div>
            {(searchQ || dateRange !== 'all') && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/trips">{tA('clear')}</Link>
              </Button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar />}
              title={tList('emptyTitle')}
              description={
                statusFilter === 'all'
                  ? tList('emptyAdminDesc')
                  : tList('emptyFilterDesc', { filter: statusFilter })
              }
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/trips/new"><Plus />{tA('new')}</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="md:hidden space-y-2.5">
              {items.map((trip) => (
                <li key={trip.trpId}>
                  <Link
                    href={peekHref(statusFilter, page, trip.trpId, searchQ, dateRange)}
                    scroll={false}
                    aria-label={tList('openAria', { ref: trip.trpRef })}
                    className={
                      'block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
                      (trip.trpId === highlightId ? 'ccms-row-highlight' : '')
                    }
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={trip.passengerName ?? '?'} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] text-text-faint tabular">{trip.trpRef}</div>
                            <div className="font-semibold text-text truncate leading-tight">{trip.passengerName ?? tCommon('unknown')}</div>
                          </div>
                          <Badge tone={STATUS_TONE[trip.trpStatus]} size="sm">{tStatus(trip.trpStatus)}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-text-muted leading-snug">
                          <span className="text-text">{trip.trpPickupAddress}</span>
                          <span className="text-text-faint"> → </span>
                          <span className="text-text">{trip.trpDropoffAddress}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-faint">
                          <span className="tabular">{formatWhen(trip.trpScheduledAt, dayLabels)}</span>
                          <span>·</span>
                          <span className="truncate">
                            {trip.driverName ? `${trip.driverName} · ${trip.vehiclePlate}` : <span className="italic">{tList('unassigned')}</span>}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-faint shrink-0 self-center" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <Card variant="outline" className="hidden md:block overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">{tList('thRef')}</TableHead>
                    <TableHead>{tList('thPassenger')}</TableHead>
                    <TableHead>{tList('thRoute')}</TableHead>
                    <TableHead>{tList('thWhen')}</TableHead>
                    <TableHead>{tList('thDriverVehicle')}</TableHead>
                    <TableHead>{tList('thStatus')}</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((trip) => (
                    <ClickableTableRow
                      key={trip.trpId}
                      href={peekHref(statusFilter, page, trip.trpId, searchQ, dateRange)}
                      scroll={false}
                      aria-label={tList('openAria', { ref: trip.trpRef })}
                      className={trip.trpId === highlightId ? 'ccms-row-highlight' : ''}
                    >
                      <TableCell className="font-mono text-xs text-text-muted tabular">{trip.trpRef}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={trip.passengerName ?? '?'} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-text truncate">{trip.passengerName ?? tCommon('unknown')}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-text text-sm leading-tight max-w-[260px] truncate">{trip.trpPickupAddress}</div>
                        <div className="text-xs text-text-faint max-w-[260px] truncate">→ {trip.trpDropoffAddress}</div>
                      </TableCell>
                      <TableCell className="text-text-muted tabular text-sm">{formatWhen(trip.trpScheduledAt, dayLabels)}</TableCell>
                      <TableCell>
                        {trip.driverName ? (
                          <>
                            <div className="text-text">{trip.driverName}</div>
                            <div className="text-xs text-text-faint font-mono tabular">{trip.vehiclePlate}</div>
                          </>
                        ) : (
                          <span className="text-xs italic text-text-faint">{tList('unassigned')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={STATUS_TONE[trip.trpStatus]} size="sm">{tStatus(trip.trpStatus)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="inline-block h-4 w-4 text-text-faint" />
                      </TableCell>
                    </ClickableTableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination summary */}
            {totalPages > 1 && (
              <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
                <span className="text-xs md:text-sm">{tList('showing')} <span className="font-semibold text-text tabular">{showingFrom}–{showingTo}</span> {tList('of')} <span className="font-semibold text-text tabular">{total}</span></span>
                <div className="inline-flex items-center gap-1 self-end md:self-auto">
                  {page > 1 ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={pageHref(statusFilter, page - 1, searchQ, dateRange)}>{tList('previous')}</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tList('previous')}</Button>
                  )}
                  <span className="px-3 text-sm tabular">{page} / {totalPages}</span>
                  {page < totalPages ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={pageHref(statusFilter, page + 1, searchQ, dateRange)}>{tList('next')}</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>{tList('next')}</Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* DRIVER role early-returned above; this Fab + drawer only render for
       * admin/manager so no role check needed here. */}
      <Fab href="/trips/new" label={tA('new')} icon={<Plus />} />

      {peekTrip && (
        <TripPeekDrawer
          trip={peekTrip}
          role={user.role}
          isAssignedDriver={peekIsAssignedDriver}
          drivers={peekDrivers}
          vehicles={peekVehicles}
        />
      )}
    </>
  );
}

/** Build /trips URL with current filter context. Omit defaults for clean URLs. */
function buildTripsHref(opts: {
  status?: string;
  q?: string;
  date?: string;
  page?: number;
  peek?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.status && opts.status !== 'pending') params.set('status', opts.status);
  if (opts.q) params.set('q', opts.q);
  if (opts.date && opts.date !== 'all') params.set('date', opts.date);
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  if (opts.peek) params.set('peek', opts.peek);
  const qs = params.toString();
  return qs ? `/trips?${qs}` : '/trips';
}

function pageHref(status: string, page: number, q?: string, date?: string): string {
  return buildTripsHref({ status, page, q, date });
}

/**
 * Build a peek URL preserving the current list filter + page so closing the
 * drawer drops the user back exactly where they were.
 */
function peekHref(status: string, page: number, tripId: string, q?: string, date?: string): string {
  return buildTripsHref({ status, page, q, date, peek: tripId });
}
