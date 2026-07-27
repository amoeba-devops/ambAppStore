import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { db } from '@car-v2/db/client';
import { carTripStopovers, carUsers } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listNonTruckDrivers } from '@/server/queries/drivers.queries';
import { getTrip } from '@/server/queries/trips.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { EditTripForm } from './edit-trip-form';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const user = await getCurrentUser();

  /* Driver cannot edit. */
  if (user.role === 'DRIVER') redirect(`/trips/${id}`);

  const trip = await getTrip(user.entId, id);
  if (!trip) notFound();

  /* Edit window: Staff (Admin/Manager) allowed unless COMPLETED. */
  if (trip.trpStatus === 'COMPLETED') {
    redirect(`/trips/${id}`);
  }

  const [users, drivers, vehicles, stopovers] = await Promise.all([
    db
      .select({
        id: carUsers.usrId,
        name: carUsers.usrName,
        email: carUsers.usrEmail,
        role: carUsers.usrLocalRole,
      })
      .from(carUsers)
      .where(and(eq(carUsers.entId, user.entId), isNull(carUsers.usrDeletedAt))),
    listNonTruckDrivers(user.entId),
    listVehicles(user.entId, 'active', 'CAR'),
    db.query.carTripStopovers.findMany({
      where: eq(carTripStopovers.tstTripId, id),
      orderBy: (t, { asc }) => asc(t.tstOrder),
    }),
  ]);

  /* Rich passenger payload (id + name + email) → form render Avatar + 2-line label.
   * Ent_id filter ở query đảm bảo cross-tenant không leak. */
  const passengerOptions = users
    .filter((u) => u.role !== 'DRIVER')
    .map((u) => ({
      id: u.id,
      name: u.name ?? null,
      email: u.email ?? null,
    }));
  const driverOptions = drivers.map((d) => ({
    id: d.drvId,
    label: `${d.user.usrName} — ${d.drvLicenseClass}`,
  }));
  const vehicleOptions = vehicles
    .filter((v) => v.cvhStatus !== 'RETIRED' && v.cvhStatus !== 'MAINTENANCE')
    .map((v) => ({ id: v.cvhId, label: `${v.cvhPlateNumber} — ${v.cvhModel}` }));

  /* Staff (Admin/Manager) có quyền vào /drivers/new, /vehicles/new. */
  const canCreateEntities = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    <>
      <PageHeader
        title={`Edit ${trip.trpRef}`}
        subtitle="Update pickup, drop-off, time and notes"
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('trips'), href: '/trips' },
          { label: trip.trpRef, href: `/trips/${id}` },
          { label: 'Edit' },
        ]}
        back={`/trips/${id}`}
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href={`/trips/${id}`}><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      {/* Mobile: regular vertical scroll. Desktop (lg): no page-level scroll —
       * EditTripForm splits into 2 cols (left form, right sticky map). */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden lg:overflow-hidden px-4 md:px-7 py-4 md:py-5 lg:py-4">
        <EditTripForm
          trip={trip}
          passengers={passengerOptions}
          drivers={driverOptions}
          vehicles={vehicleOptions}
          initialStopovers={stopovers.map((s) => s.tstAddress)}
          role={user.role}
          canCreateEntities={canCreateEntities}
        />
      </div>
    </>
  );
}
