import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getTrip } from '@/server/queries/trips.queries';
import { getTripStopovers } from '@/server/queries/stopovers.queries';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { PageHeader } from '@/components/layout/page-header';
import { StopUpdateList } from './_components/stop-update-list';

/** Driver real-time stop-update page (REQ-20260623).
 * Driver sees each stop in order and can fill in km + arrival time. */
export default async function DriverTruckStopUpdatePage({
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

  if (!trip || trip.trpKind !== 'LOG' || !driver || trip.trpDriverId !== driver.drvId) {
    notFound();
  }

  const stopovers = await getTripStopovers(user.entId, trip.trpId);
  const t = await getTranslations('today.truck');

  return (
    <>
      <PageHeader
        title={trip.trpRef}
        subtitle={trip.trpPickupAddress + ' → ' + trip.trpDropoffAddress}
        breadcrumbs={[{ label: t('title'), href: '/today' }, { label: trip.trpRef }]}
        back="/today"
        mobileVariant="brand"
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-5 max-w-xl w-full">
        <StopUpdateList tripId={id} stopovers={stopovers} />
      </div>
    </>
  );
}
