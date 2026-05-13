import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar, ChevronRight, Download, Filter, Plus, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';

type TripStatus =
  | 'PENDING_ASSIGNMENT'
  | 'PENDING_DRIVER_CONFIRMATION'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED_BY_DRIVER'
  | 'CANCELLED';

const STATUS_TONE: Record<TripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

const STATUS_LABEL: Record<TripStatus, string> = {
  PENDING_ASSIGNMENT:          'Pending assignment',
  PENDING_DRIVER_CONFIRMATION: 'Pending driver',
  CONFIRMED:                   'Confirmed',
  IN_PROGRESS:                 'In progress',
  COMPLETED:                   'Completed',
  REJECTED_BY_DRIVER:          'Rejected',
  CANCELLED:                   'Cancelled',
};

interface TripRow {
  id: string;
  ref: string;
  passenger: string;
  passengerRole: string;
  pickup: string;
  dropoff: string;
  when: string;
  driver: string | null;
  plate: string | null;
  status: TripStatus;
}

const TRIPS: TripRow[] = [
  { id: 't-1042', ref: 'TR-1042', passenger: 'Park Joon-ho',  passengerRole: 'CEO',          pickup: 'D1 HCMC', dropoff: 'Tan Son Nhat T2',  when: 'Today · 14:30',   driver: 'Nguyễn Văn Tú',    plate: '51K-238.91', status: 'IN_PROGRESS' },
  { id: 't-1041', ref: 'TR-1041', passenger: 'Kim Min-seo',   passengerRole: 'Dir, Ops',     pickup: 'D7 Phú Mỹ Hưng', dropoff: 'Long Hậu IZ', when: 'Today · 15:30', driver: 'Trần Quốc Hùng', plate: '30A-556.07', status: 'CONFIRMED' },
  { id: 't-1040', ref: 'TR-1040', passenger: 'Choi Ji-woo',   passengerRole: 'Dir, Sales',   pickup: 'D3 HCMC', dropoff: 'Diamond Plaza',   when: 'Today · 17:00',  driver: null,                plate: null,         status: 'PENDING_ASSIGNMENT' },
  { id: 't-1039', ref: 'TR-1039', passenger: 'Nguyễn Thu Hà', passengerRole: 'VP, Finance',  pickup: 'Bitexco', dropoff: 'D2 The Manor',    when: 'Tomorrow · 09:00', driver: 'Lê Minh Đức',     plate: '51F-712.34', status: 'PENDING_DRIVER_CONFIRMATION' },
  { id: 't-1038', ref: 'TR-1038', passenger: 'Lee Hyun-jung', passengerRole: 'Mgr, IT',      pickup: 'D1 HCMC', dropoff: 'Saigon Centre',   when: 'Tomorrow · 10:30', driver: 'Nguyễn Văn Tú',  plate: '51K-238.91', status: 'CONFIRMED' },
  { id: 't-1037', ref: 'TR-1037', passenger: 'Park Joon-ho',  passengerRole: 'CEO',          pickup: 'SGN T1',  dropoff: 'D1 Park Hyatt',   when: 'May 11 · 19:00', driver: 'Trần Quốc Hùng', plate: '30A-556.07', status: 'COMPLETED' },
  { id: 't-1036', ref: 'TR-1036', passenger: 'Kim Min-seo',   passengerRole: 'Dir, Ops',     pickup: 'D1 HCMC', dropoff: 'Bình Dương',      when: 'May 10 · 08:00', driver: 'Lê Minh Đức',     plate: '51F-712.34', status: 'COMPLETED' },
  { id: 't-1035', ref: 'TR-1035', passenger: 'Choi Ji-woo',   passengerRole: 'Dir, Sales',   pickup: 'D7 HCMC', dropoff: 'Long Hậu IZ',     when: 'May 9 · 14:00',  driver: 'Trần Quốc Hùng', plate: '30A-556.07', status: 'REJECTED_BY_DRIVER' },
];

const FILTERS = [
  { key: 'all',         label: 'All',          count: 142 },
  { key: 'pending',     label: 'Pending',      count:  12 },
  { key: 'in-progress', label: 'In progress',  count:   3 },
  { key: 'completed',   label: 'Completed',    count: 124 },
  { key: 'cancelled',   label: 'Cancelled',    count:   3 },
];

export default async function TripsListPage() {
  const t    = await getTranslations('screens.tripsList');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('trips') }]}
        actions={
          <>
            <Button variant="ghost" size="md" iconLeft={<Download />}>{tA('export')}</Button>
            <Button variant="accent" size="md" asChild>
              <Link href="/trips/new"><Plus />{tA('new')}</Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5 space-y-4">
        {/* Filter bar — horizontal scroll on mobile, flex layout on desktop */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Segmented tabs */}
          <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto">
            <div className="inline-flex items-center gap-1 rounded-md bg-surface-2 p-1">
              {FILTERS.map((f, i) => (
                <button
                  key={f.key}
                  className={
                    'inline-flex items-center gap-2 h-8 px-3 rounded text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                    (i === 0 ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text')
                  }
                >
                  {f.label}
                  <span className="text-xs tabular text-text-faint">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Search + secondary actions */}
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

        {/* Mobile: card list */}
        <ul className="md:hidden space-y-2.5">
          {TRIPS.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                aria-label={`Open ${trip.ref}`}
                className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={trip.passenger} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-text-faint tabular">{trip.ref}</div>
                        <div className="font-semibold text-text truncate leading-tight">{trip.passenger}</div>
                      </div>
                      <Badge tone={STATUS_TONE[trip.status]} size="sm">{STATUS_LABEL[trip.status]}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-text-muted leading-snug">
                      <span className="text-text">{trip.pickup}</span>
                      <span className="text-text-faint"> → </span>
                      <span className="text-text">{trip.dropoff}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-text-faint">
                      <span className="tabular">{trip.when}</span>
                      <span>·</span>
                      <span className="truncate">
                        {trip.driver ? `${trip.driver} · ${trip.plate}` : <span className="italic">Unassigned</span>}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-text-faint shrink-0 self-center" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop: table */}
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
              {TRIPS.map((trip) => (
                <TableRow key={trip.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs text-text-muted tabular">{trip.ref}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={trip.passenger} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-text truncate">{trip.passenger}</div>
                        <div className="text-xs text-text-faint truncate">{trip.passengerRole}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-text text-sm leading-tight">{trip.pickup}</div>
                    <div className="text-xs text-text-faint">→ {trip.dropoff}</div>
                  </TableCell>
                  <TableCell className="text-text-muted tabular">{trip.when}</TableCell>
                  <TableCell>
                    {trip.driver ? (
                      <>
                        <div className="text-text">{trip.driver}</div>
                        <div className="text-xs text-text-faint font-mono tabular">{trip.plate}</div>
                      </>
                    ) : (
                      <span className="text-xs italic text-text-faint">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[trip.status]} size="sm">{STATUS_LABEL[trip.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/trips/${trip.id}`} aria-label={`Open ${trip.ref}`}>{tA('view')}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination summary */}
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 text-sm text-text-muted">
          <span className="text-xs md:text-sm">Showing <span className="font-semibold text-text tabular">1–8</span> of <span className="font-semibold text-text tabular">142</span> trips</span>
          <div className="inline-flex items-center gap-1 self-end md:self-auto">
            <Button variant="ghost" size="sm" disabled>Previous</Button>
            <Button variant="primary" size="sm">1</Button>
            <Button variant="ghost" size="sm">2</Button>
            <Button variant="ghost" size="sm">3</Button>
            <span className="px-2 text-text-faint">…</span>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">18</Button>
            <Button variant="ghost" size="sm">Next</Button>
          </div>
        </div>
      </div>

      {/* Mobile FAB — primary action */}
      <Fab href="/trips/new" label={tA('new')} icon={<Plus />} />
    </AppShell>
  );
}
