import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTrip } from '@/server/queries/trips.queries';
import { getTripExtraCosts } from '@/server/queries/truck-trips.queries';
import { getTripStopovers } from '@/server/queries/stopovers.queries';
import { getTenantSettings } from '@/server/queries/tenant-settings.queries';
import { getLatestTruckReportForMonth } from '@/server/queries/truck-report.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { listFleetDrivers } from '@/server/queries/drivers.queries';
import { TruckTripForm } from '../../_components/truck-trip-form';

export default async function EditTruckTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const trip = await getTrip(user.entId, id);
  if (!trip || trip.trpKind !== 'LOG') notFound();

  const t = await getTranslations('screens.truckTrips');
  const tripMonth = new Date(trip.trpScheduledAt).toISOString().slice(0, 7);
  const [vehicles, drivers, extras, stopovers, settings, monthReport] = await Promise.all([
    listVehicles(user.entId, 'active', 'TRUCK'),
    listFleetDrivers(user.entId, 'TRUCK'),
    getTripExtraCosts(user.entId, trip.trpId),
    getTripStopovers(user.entId, trip.trpId),
    getTenantSettings(user.entId),
    getLatestTruckReportForMonth(user.entId, tripMonth),
  ]);
  const vehicleOptions = vehicles.map((v) => ({ id: v.cvhId, label: `${v.cvhPlateNumber} · ${v.cvhModel}` }));
  const driverOptions = drivers.map((d) => ({ id: d.drvId, label: d.user.usrName ?? d.user.usrEmail ?? d.drvId }));

  const initial = {
    scheduledAt: new Date(trip.trpScheduledAt).toISOString().slice(0, 10),
    vehicleId: trip.trpVehicleId ?? '',
    driverId: trip.trpDriverId ?? '',
    customer: trip.trpCustomer ?? '',
    pickup: trip.trpPickupAddress,
    dropoff: trip.trpDropoffAddress,
    bol: trip.trpBol ?? '',
    cdf: trip.trpCdf ?? '',
    revenue: trip.trpRevenue ?? '',
    fuelPrice: trip.trpFuelPrice ?? '',
    fuelLiters: trip.trpFuelLiters ?? '',
    toll: trip.trpTollFee ?? '',
    extraCosts: extras.map((e) => ({ name: e.name, amount: e.amount })),
    markCompleted: trip.trpStatus === 'COMPLETED',
    stopovers: stopovers.length > 0 ? stopovers : undefined,
  };

  return (
    <>
      <PageHeader
        title={t('editTitle')}
        subtitle={trip.trpRef}
        breadcrumbs={[
          { label: t('title'), href: '/truck/trips' },
          { label: trip.trpRef, href: `/truck/trips/${trip.trpId}` },
          { label: t('editCrumb') },
        ]}
        back={`/truck/trips/${trip.trpId}`}
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-7xl mx-auto md:mx-0 w-full space-y-4">
        {/* Reported month — soft warning (Q1 decision: no lock). Editing stays
         * allowed; the official numbers update on the next "Lập báo cáo". */}
        {monthReport && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{t('reportedMonthBanner')}</span>
          </div>
        )}
        <TruckTripForm
          vehicles={vehicleOptions}
          drivers={driverOptions}
          role={user.role}
          depotAddress={settings?.tnsDepotAddress}
          tripId={trip.trpId}
          initial={initial}
        />
      </div>
    </>
  );
}
