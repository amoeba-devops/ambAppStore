import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { computeTruckCost, parseAmount } from '@car-v2/core/truck';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTrip } from '@/server/queries/trips.queries';
import { getTripExtraCosts } from '@/server/queries/truck-trips.queries';
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
  const extras = await getTripExtraCosts(user.entId, trip.trpId);
  const breakdown = computeTruckCost({
    fuelLiters: parseAmount(trip.trpFuelLiters),
    fuelPrice: parseAmount(trip.trpFuelPrice),
    tollFee: parseAmount(trip.trpTollFee),
    extraCosts: extras.map((e) => e.amount),
    revenue: parseAmount(trip.trpRevenue),
  });
  const completed = trip.trpStatus === 'COMPLETED';
  const canComplete = !completed && (trip.trpStatus === 'CONFIRMED' || trip.trpStatus === 'IN_PROGRESS');

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
      breakdown={breakdown}
      completed={completed}
      canComplete={canComplete}
      mode="staff"
      backHref="/truck/trips"
      parentLabel={tNav('truckTrips')}
      actions={<TruckTripManageActions tripId={trip.trpId} />}
    />
  );
}
