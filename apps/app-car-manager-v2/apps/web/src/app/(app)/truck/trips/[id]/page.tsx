import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTrip } from '@/server/queries/trips.queries';
import { getTripExtraCosts, getTruckTripBreakdown, getTripCostAttachmentsView } from '@/server/queries/truck-trips.queries';
import { getTruckReportStatus } from '@/server/queries/truck-report.queries';
import { getTripStopovers } from '@/server/queries/stopovers.queries';
import { TruckTripDetail } from '@/app/(app)/trips/[id]/_components/truck-trip-detail';
import { TruckTripManageActions } from '../_components/truck-trip-manage-actions';

/** Manager truck trip detail (themed truck workspace). The `/truck` layout gates
 * TRUCK access + non-driver. Reuses the shared TruckTripDetail with manager
 * edit/delete affordances + truck breadcrumb. */
export default async function TruckTripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(user.entId, id);
  if (!trip || trip.trpKind !== 'LOG') notFound();

  const tNav = await getTranslations('nav');
  const [extras, stopovers, costAttachments] = await Promise.all([
    getTripExtraCosts(user.entId, trip.trpId),
    getTripStopovers(user.entId, trip.trpId),
    getTripCostAttachmentsView(user.entId, trip.trpId),
  ]);
  const {
    breakdown,
    fuelMode,
    km: fuelKm,
    fuelCostPerKm,
    salaryAllocated,
    depreciationAllocated,
    profitAfterFixed,
    fixedTripCount,
    month,
    region,
  } = await getTruckTripBreakdown(user.entId, trip, extras.map((e) => e.amount));
  const completed = trip.trpStatus === 'COMPLETED';
  const canComplete = !completed && (trip.trpStatus === 'CONFIRMED' || trip.trpStatus === 'IN_PROGRESS');
  const reportStatus = completed ? await getTruckReportStatus(user.entId, month, region || null) : null;

  return (
    <TruckTripDetail
      tripId={trip.trpId}
      tripRef={trip.trpRef}
      status={trip.trpStatus}
      scheduledAt={trip.trpScheduledAt}
      customer={trip.trpCustomer}
      bol={trip.trpBol}
      cdf={trip.trpCdf}
      pickup={trip.trpPickupAddress}
      dropoff={trip.trpDropoffAddress}
      vehiclePlate={trip.vehiclePlate}
      driverName={trip.driverName}
      extras={extras}
      costAttachments={costAttachments}
      breakdown={breakdown}
      fuelMode={completed ? fuelMode : undefined}
      fuelKm={fuelKm}
      fuelCostPerKm={fuelCostPerKm}
      salaryAllocated={completed ? salaryAllocated : undefined}
      depreciationAllocated={completed ? depreciationAllocated : undefined}
      profitAfterFixed={completed ? profitAfterFixed : undefined}
      fixedTripCount={fixedTripCount}
      completed={completed}
      canComplete={canComplete}
      stopovers={stopovers}
      mode="staff"
      backHref="/truck/trips"
      parentLabel={tNav('truckTrips')}
      actions={<TruckTripManageActions tripId={trip.trpId} />}
      reportStatus={reportStatus}
    />
  );
}
