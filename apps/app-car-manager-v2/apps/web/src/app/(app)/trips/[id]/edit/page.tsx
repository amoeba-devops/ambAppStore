import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getTrip } from '@/server/queries/trips.queries';
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

  /* Edit window: pre-confirm only for Manager; Admin allowed unless COMPLETED. */
  if (user.role === 'MANAGER') {
    if (trip.trpCreatorId !== user.userId) redirect(`/trips/${id}`);
    if (trip.trpStatus !== 'PENDING_ASSIGNMENT' && trip.trpStatus !== 'PENDING_DRIVER_CONFIRMATION') {
      redirect(`/trips/${id}`);
    }
  }
  if (user.role === 'ADMIN' && trip.trpStatus === 'COMPLETED') {
    redirect(`/trips/${id}`);
  }

  const users = await db
    .select({ id: carUsers.usrId, name: carUsers.usrName, role: carUsers.usrLocalRole })
    .from(carUsers)
    .where(and(eq(carUsers.entId, user.entId), isNull(carUsers.usrDeletedAt)));

  const passengerOptions = users
    .filter((u) => u.role !== 'DRIVER')
    .map((u) => ({ id: u.id, label: u.name ?? u.id }));

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

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <EditTripForm trip={trip} passengers={passengerOptions} role={user.role} />
      </div>
    </>
  );
}
