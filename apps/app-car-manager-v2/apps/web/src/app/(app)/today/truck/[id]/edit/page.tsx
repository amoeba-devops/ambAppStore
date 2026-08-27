import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { getTrip } from '@/server/queries/trips.queries';
import { getTripExtraCosts, getTripCostAttachmentsView } from '@/server/queries/truck-trips.queries';
import { getTripStopovers } from '@/server/queries/stopovers.queries';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { getLatestTruckReportForMonth } from '@/server/queries/truck-report.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { TruckTripForm } from '@/app/(app)/truck/trips/_components/truck-trip-form';

/** Date → 'HH:mm' for the form's <input type="time">; '' when unset. */
/* Trip start/end are a WALL CLOCK stored in UTC (parseWallClockUtc) — read
 * them back in UTC too, or the form would show a different time than the one
 * the user typed on any server/browser that isn't UTC (REQ-20260824). */
function hhmm(d: Date | null): string {
  if (!d) return '';
  const x = new Date(d);
  return `${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Driver self-edit of their own truck trip (REQ-20260803).
 *
 * Lives under /today for the same reason the driver create page does: the
 * truck layout redirects every DRIVER to /today, so /truck/trips/{id}/edit is
 * unreachable for them. Reuses TruckTripForm in DRIVER mode — revenue hidden,
 * driver locked to self — and posts to the ownership-checked driver action.
 */
export default async function DriverEditTruckTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  requireRole(user.role, ['DRIVER']);
  await requireFleet(user, 'TRUCK');

  const driver = await getDriverByUserId(user.entId, user.userId);
  const trip = await getTrip(user.entId, id);
  /* Same ownership rule the action enforces — a driver only ever edits a truck
   * log of their own; anything else simply doesn't exist for them. */
  if (!trip || trip.trpKind !== 'LOG' || !driver || trip.trpDriverId !== driver.drvId) {
    notFound();
  }

  const tripMonth = new Date(trip.trpScheduledAt).toISOString().slice(0, 7);
  const [vehicles, extras, stopovers, settings, monthReport, costAttachments] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    getTripExtraCosts(user.entId, trip.trpId),
    getTripStopovers(user.entId, trip.trpId),
    getTenantSettings(user.entId),
    getLatestTruckReportForMonth(user.entId, tripMonth),
    getTripCostAttachmentsView(user.entId, trip.trpId),
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.cvhId,
    label: `${v.cvhPlateNumber} · ${v.cvhModel}`,
  }));

  const initial = {
    scheduledAt: new Date(trip.trpScheduledAt).toISOString().slice(0, 10),
    vehicleId: trip.trpVehicleId ?? '',
    customer: trip.trpCustomer ?? '',
    pickup: trip.trpPickupAddress,
    dropoff: trip.trpDropoffAddress,
    bol: trip.trpBol ?? '',
    cdf: trip.trpCdf ?? '',
    notes: trip.trpNotes ?? '',
    startTime: hhmm(trip.trpStartedAt),
    endTime: hhmm(trip.trpEndedAt),
    fuelPrice: trip.trpFuelPrice ?? '',
    fuelLiters: trip.trpFuelLiters ?? '',
    toll: trip.trpTollFee ?? '',
    extraCosts: extras.map((e) => ({ name: e.name, amount: e.amount })),
    costAttachments: costAttachments.map((a) => ({
      id: a.id,
      costKind: a.costKind,
      s3Key: a.s3Key,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      signedUrl: a.signedUrl,
    })),
    stopovers: stopovers.length > 0 ? stopovers : undefined,
  };

  const t = await getTranslations('screens.truckTrips');
  const tToday = await getTranslations('today.truck');

  return (
    <>
      <PageHeader
        title={t('editTitle')}
        subtitle={trip.trpRef}
        breadcrumbs={[
          { label: tToday('title'), href: '/today' },
          { label: trip.trpRef, href: `/today/truck/${trip.trpId}` },
          { label: t('editCrumb') },
        ]}
        /* Default 'breadcrumb' variant — a form needs the back chevron that
         * the 'brand' home-route header does not render. */
        back={`/today/truck/${trip.trpId}`}
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Reported month — soft warning, not a lock: the figures the manager
          * already exported will change on the next "Lập báo cáo". A CLOSED
          * month is the hard stop, and the action refuses it. */}
        {monthReport && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{t('reportedMonthBanner')}</span>
          </div>
        )}
        {/* drivers=[] — DRIVER mode locks the trip to the caller, so no list. */}
        <TruckTripForm
          vehicles={vehicleOptions}
          drivers={[]}
          role={user.role}
          depotAddress={settings?.tnsDepotAddress}
          tripId={trip.trpId}
          initial={initial}
        />
      </div>
    </>
  );
}
