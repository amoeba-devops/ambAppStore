import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDrivers } from '@/server/queries/drivers.queries';
import { getTrip, listTrips, listTripsForCalendar } from '@/server/queries/trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { rangeForView } from './_components/calendar/utils';
import { DashboardCreateButton } from './_components/dashboard-create-button';
import { DashboardShell } from './_components/dashboard-shell';

interface DashboardPageProps {
  searchParams: Promise<{ peek?: string; highlight?: string; create?: string }>;
}

const RECENT_TRIPS_LIMIT = 12;

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const sp = await searchParams;
  const tCo = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tD = await getTranslations('dashboard');
  const user = await getCurrentUser();

  /* DRIVER doesn't have a fleet-wide schedule view — they see their own
   * trips in /today's PWA-first view. Redirect rather than 403 so a deep
   * link from email/Slack just lands them in the right place. */
  if (user.role === 'DRIVER') redirect('/today');

  /* Initial calendar range covers current month ± 1 week. Client refetches
   * when the user navigates. */
  const range = rangeForView(new Date(), 'month');

  const [calendarTrips, recentListing, vehiclesRaw, drivers, users, peekTrip] = await Promise.all([
    listTripsForCalendar({
      entId: user.entId,
      role: user.role,
      userId: user.userId,
      rangeStart: range.start,
      rangeEnd: range.end,
    }),
    /* Side panel "Trips" list — broader scope than the calendar range so the
     * user sees recent past + future activity. Pagination is the same query
     * used by /trips, just truncated. */
    listTrips({
      entId: user.entId,
      role: user.role,
      userId: user.userId,
      status: 'all',
      page: 1,
    }),
    listVehicles(user.entId),
    listDrivers(user.entId),
    db
      .select({ id: carUsers.usrId, name: carUsers.usrName, role: carUsers.usrLocalRole })
      .from(carUsers)
      .where(and(eq(carUsers.entId, user.entId), isNull(carUsers.usrDeletedAt))),
    sp.peek ? getTrip(user.entId, sp.peek) : Promise.resolve(null),
  ]);

  const recentTrips = recentListing.items.slice(0, RECENT_TRIPS_LIMIT);

  /* Per-vehicle active trip count (IN_PROGRESS) — feeds VehicleLegend
   * "In Use ({count})" badge. Cheap derived value, no extra query. */
  const activeByVehicle = new Map<string, number>();
  for (const tr of calendarTrips) {
    if (tr.trpStatus !== 'IN_PROGRESS' || !tr.trpVehicleId) continue;
    activeByVehicle.set(tr.trpVehicleId, (activeByVehicle.get(tr.trpVehicleId) ?? 0) + 1);
  }

  const legendVehicles = vehiclesRaw.map((v) => ({
    id: v.cvhId,
    plate: v.cvhPlateNumber,
    status: v.cvhStatus,
    activeTripCount: activeByVehicle.get(v.cvhId) ?? 0,
  }));

  const passengerOptions = users
    .filter((u) => u.role !== 'DRIVER')
    .map((u) => ({ id: u.id, label: u.name ?? u.id }));
  const driverOptions = drivers.map((d) => ({
    id: d.drvId,
    label: `${d.user.usrName} — ${d.drvLicenseClass}`,
  }));
  const formVehicleOptions = vehiclesRaw
    .filter((v) => v.cvhStatus !== 'RETIRED' && v.cvhStatus !== 'MAINTENANCE')
    .map((v) => ({ id: v.cvhId, label: `${v.cvhPlateNumber} — ${v.cvhModel}` }));

  /* Build the peek-drawer context server-side so the Shell's drawer renders
   * with full assignment lists when needed (Admin) and a minimal context
   * otherwise. Keeps the Shell payload predictable. */
  const peek = peekTrip
    ? {
        trip: peekTrip,
        drivers:
          user.role === 'ADMIN'
            ? drivers.map((d) => ({
                id: d.drvId,
                label: `${d.user.usrName} — ${d.drvLicenseNumber} (${d.drvLicenseClass})`,
              }))
            : [],
        vehicles:
          user.role === 'ADMIN'
            ? vehiclesRaw.map((v) => ({
                id: v.cvhId,
                label: `${v.cvhPlateNumber} — ${v.cvhMake ?? ''} ${v.cvhModel}`.trim(),
              }))
            : [],
        isCreator: peekTrip.trpCreatorId === user.userId,
      }
    : null;

  return (
    <>
      <PageHeader
        title={tD('title')}
        subtitle={tD('subtitle', { count: calendarTrips.length, role: user.role })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('dashboard') }]}
        actions={<DashboardCreateButton />}
        mobileVariant="brand"
      />
      {/* Calendar drives the row height via its natural intrinsic size
       * (time-grid: 17 hours × HOUR_HEIGHT + header ≈ 780px); the right
       * rail mirrors that via `lg:items-stretch` on the grid. We keep the
       * page wrapper `overflow-auto` so if the calendar ever exceeds the
       * viewport (small screens, big future calendar variants) the page
       * scrolls — but in normal cases the dashboard fits and adds no
       * extra scroll height. */}
      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-5">
        <DashboardShell
          initialTrips={calendarTrips}
          recentTrips={recentTrips}
          vehicles={legendVehicles}
          passengers={passengerOptions}
          drivers={driverOptions}
          vehicleOptions={formVehicleOptions}
          currentUser={{ role: user.role, userId: user.userId }}
          highlightId={sp.highlight ?? null}
          createSignal={sp.create === '1'}
          peek={peek}
        />
      </div>
      {/* Mobile-only FAB. PageHeader's `actions` slot (the desktop "+ Tạo"
       * button) lives inside the `md:block` chrome — invisible on phones —
       * so we surface the same action via the FAB pattern. Linking to
       * `?create=1` reuses the existing URL signal the shell listens to. */}
      <Fab href="/dashboard?create=1" label={tD('form.titleCreate')} icon={<Plus />} />
    </>
  );
}
