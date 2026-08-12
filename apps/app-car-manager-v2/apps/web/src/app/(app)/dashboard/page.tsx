import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { Fab } from '@/components/layout/fab';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { driverIdentity, personIdentity } from '@/lib/format-person-option';
import { listNonTruckDrivers } from '@/server/queries/drivers.queries';
import { getTrip, listTripsForCalendar } from '@/server/queries/trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { rangeForView } from './_components/calendar/utils';
import { DashboardCreateButton } from './_components/dashboard-create-button';
import { DashboardShell } from './_components/dashboard-shell';

interface DashboardPageProps {
  searchParams: Promise<{ peek?: string; highlight?: string; create?: string }>;
}

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

  const [calendarTrips, vehiclesRaw, drivers, users, peekTrip] = await Promise.all([
    listTripsForCalendar({
      entId: user.entId,
      role: user.role,
      userId: user.userId,
      rangeStart: range.start,
      rangeEnd: range.end,
      /* Lịch điều xe — chuyến xe tải (LOG) có màn riêng /truck/trips.
       * fetchTripsForCalendarAction (client re-fetch khi đổi tháng) phải truyền
       * cùng giá trị, nếu không chuyến xe tải hiện lại ngay lần đổi tháng đầu. */
      kind: 'DISPATCH',
    }),
    /* The side panel's "Trips" list used to be a SECOND, all-time listing here.
     * It is gone: the rail now renders whatever window the calendar is showing
     * (DashboardShell derives it from the client-fetched set), which is what the
     * period selector is expected to control. One less query per render, and the
     * two halves of the page can no longer disagree. */
    /* 'CAR' — vehicle legend + booking form của workspace xe con; xe tải có
     * dashboard riêng ở /truck/dashboard. */
    listVehicles(user.entId, 'active', 'CAR'),
    listNonTruckDrivers(user.entId),
    db
      .select({
        id: carUsers.usrId,
        name: carUsers.usrName,
        email: carUsers.usrEmail,
        role: carUsers.usrLocalRole,
      })
      .from(carUsers)
      .where(and(eq(carUsers.entId, user.entId), isNull(carUsers.usrDeletedAt))),
    sp.peek ? getTrip(user.entId, sp.peek) : Promise.resolve(null),
  ]);

  /* Legend rows only — the "In Use ({count})" badge is derived client-side from
   * the visible period, so counting here would just freeze it at this month. */
  const legendVehicles = vehiclesRaw.map((v) => ({
    id: v.cvhId,
    plate: v.cvhPlateNumber,
    status: v.cvhStatus,
  }));

  const passengerOptions = users
    .filter((u) => u.role !== 'DRIVER')
    /* Email đi kèm tên vì tên hiển thị không duy nhất — /trips/new và
     * /trips/[id]/edit đã hiện email từ trước, dialog tạo nhanh này thì chưa,
     * nên cùng một danh sách hành khách lại trông khác nhau tuỳ màn. */
    .map((u) => ({ id: u.id, label: personIdentity({ usrName: u.name, usrEmail: u.email }, u.id) }));
  const driverOptions = drivers.map((d) => ({
    id: d.drvId,
    label: `${driverIdentity(d)} — ${d.drvLicenseClass}`,
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
          user.role === 'ADMIN' || user.role === 'MANAGER'
            ? drivers.map((d) => ({
                id: d.drvId,
                label: `${driverIdentity(d)} — ${d.drvLicenseNumber} (${d.drvLicenseClass})`,
              }))
            : [],
        vehicles:
          user.role === 'ADMIN' || user.role === 'MANAGER'
            ? vehiclesRaw.map((v) => ({
                id: v.cvhId,
                label: `${v.cvhPlateNumber} — ${v.cvhMake ?? ''} ${v.cvhModel}`.trim(),
              }))
            : [],
      }
    : null;

  return (
    <>
      <PageHeader
        title={tD('title')}
        /* Role only. The trip count moved into the calendar toolbar, next to the
         * period navigator: this header is server-rendered once, so any number
         * here is stuck on the month the page loaded with — which read as a bug
         * the moment the user navigated to another month. */
        subtitle={tD('subtitleRole', { role: user.role })}
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
