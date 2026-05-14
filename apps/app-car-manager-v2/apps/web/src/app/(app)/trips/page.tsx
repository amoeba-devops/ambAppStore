import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Download, Filter, Plus, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listTrips } from '@/server/queries/trips.queries';

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};
const STATUS_LABEL: Record<CarTripStatus, string> = {
  PENDING_ASSIGNMENT:          'Pending assignment',
  PENDING_DRIVER_CONFIRMATION: 'Pending driver',
  CONFIRMED:                   'Confirmed',
  IN_PROGRESS:                 'In progress',
  COMPLETED:                   'Completed',
  REJECTED_BY_DRIVER:          'Rejected',
  CANCELLED:                   'Cancelled',
};

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'pending',     label: 'Pending' },
  { key: 'active',      label: 'Active' },
  { key: 'completed',   label: 'Completed' },
];

function formatWhen(iso: Date): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  if (days === -1) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} · ${time}`;
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function TripsListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();

  const statusFilter = (sp.status ?? 'all') as 'all' | 'pending' | 'active' | 'completed';
  const page = Math.max(1, Number(sp.page ?? 1));

  const { items, total, pageSize } = await listTrips({
    entId: user.entId,
    role: user.role,
    userId: user.userId,
    status: statusFilter,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingTo = Math.min(total, page * pageSize);
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;

  return (
    <>
      <PageHeader
        title={tNav('trips')}
        subtitle={`${total} trip${total === 1 ? '' : 's'} · viewing as ${user.role}`}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('trips') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')}</Button>
            {user.role !== 'DRIVER' && (
              <Button variant="accent" size="md" asChild>
                <Link href="/trips/new"><Plus />{tA('new')}</Link>
              </Button>
            )}
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
                return (
                  <Link
                    key={f.key}
                    href={f.key === 'all' ? '/trips' : `/trips?status=${f.key}`}
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
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search…"
              iconLeft={<Search />}
              className="flex-1 md:w-72 md:flex-initial"
            />
            <Button variant="secondary" size="md" iconLeft={<Calendar />} className="hidden md:inline-flex">This week</Button>
            <Button variant="ghost" size="icon" aria-label={tA('filter')}><Filter /></Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar />}
              title="No trips here"
              description={
                statusFilter === 'all'
                  ? user.role === 'DRIVER'
                    ? 'You have no trips assigned to you yet.'
                    : 'Create the first trip to get started.'
                  : `No trips match the "${statusFilter}" filter.`
              }
              action={
                user.role !== 'DRIVER' ? (
                  <Button variant="accent" size="md" asChild>
                    <Link href="/trips/new"><Plus />{tA('new')}</Link>
                  </Button>
                ) : undefined
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
                    href={`/trips/${trip.trpId}`}
                    aria-label={`Open ${trip.trpRef}`}
                    className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={trip.passengerName ?? '?'} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] text-text-faint tabular">{trip.trpRef}</div>
                            <div className="font-semibold text-text truncate leading-tight">{trip.passengerName ?? 'Unknown'}</div>
                          </div>
                          <Badge tone={STATUS_TONE[trip.trpStatus]} size="sm">{STATUS_LABEL[trip.trpStatus]}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-text-muted leading-snug">
                          <span className="text-text">{trip.trpPickupAddress}</span>
                          <span className="text-text-faint"> → </span>
                          <span className="text-text">{trip.trpDropoffAddress}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-text-faint">
                          <span className="tabular">{formatWhen(trip.trpScheduledAt)}</span>
                          <span>·</span>
                          <span className="truncate">
                            {trip.driverName ? `${trip.driverName} · ${trip.vehiclePlate}` : <span className="italic">Unassigned</span>}
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
                    <TableHead className="w-[100px]">Ref</TableHead>
                    <TableHead>Passenger</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Driver / Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((trip) => (
                    <TableRow key={trip.trpId} className="cursor-pointer">
                      <TableCell className="font-mono text-xs text-text-muted tabular">{trip.trpRef}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={trip.passengerName ?? '?'} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-text truncate">{trip.passengerName ?? 'Unknown'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-text text-sm leading-tight max-w-[260px] truncate">{trip.trpPickupAddress}</div>
                        <div className="text-xs text-text-faint max-w-[260px] truncate">→ {trip.trpDropoffAddress}</div>
                      </TableCell>
                      <TableCell className="text-text-muted tabular text-sm">{formatWhen(trip.trpScheduledAt)}</TableCell>
                      <TableCell>
                        {trip.driverName ? (
                          <>
                            <div className="text-text">{trip.driverName}</div>
                            <div className="text-xs text-text-faint font-mono tabular">{trip.vehiclePlate}</div>
                          </>
                        ) : (
                          <span className="text-xs italic text-text-faint">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge tone={STATUS_TONE[trip.trpStatus]} size="sm">{STATUS_LABEL[trip.trpStatus]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/trips/${trip.trpId}`} aria-label={`Open ${trip.trpRef}`}>{tA('view')}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination summary */}
            {totalPages > 1 && (
              <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
                <span className="text-xs md:text-sm">Showing <span className="font-semibold text-text tabular">{showingFrom}–{showingTo}</span> of <span className="font-semibold text-text tabular">{total}</span></span>
                <div className="inline-flex items-center gap-1 self-end md:self-auto">
                  {page > 1 ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={pageHref(statusFilter, page - 1)}>Previous</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>Previous</Button>
                  )}
                  <span className="px-3 text-sm tabular">{page} / {totalPages}</span>
                  {page < totalPages ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={pageHref(statusFilter, page + 1)}>Next</Link>
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>Next</Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {user.role !== 'DRIVER' && (
        <Fab href="/trips/new" label={tA('new')} icon={<Plus />} />
      )}
    </>
  );
}

function pageHref(status: string, page: number): string {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/trips?${qs}` : '/trips';
}
