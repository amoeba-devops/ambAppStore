import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, isNull, and } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listNonTruckDrivers } from '@/server/queries/drivers.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { NewTripForm } from './new-trip-form';

export default async function NewTripPage() {
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');
  const tScr = await getTranslations('screens.newTrip');
  const user = await getCurrentUser();

  /* Driver doesn't create trips. */
  if (user.role === 'DRIVER') redirect('/trips');

  /* Fetch select options in parallel. Ent-id isolation đã enforce trong
   * listDrivers/listVehicles (ent_id filter); carUsers query thêm điều kiện
   * entId ở đây để khớp pattern. */
  const [drivers, vehicles, users] = await Promise.all([
    listNonTruckDrivers(user.entId),
    listVehicles(user.entId),
    db
      .select({
        id: carUsers.usrId,
        name: carUsers.usrName,
        email: carUsers.usrEmail,
        role: carUsers.usrLocalRole,
      })
      .from(carUsers)
      .where(and(eq(carUsers.entId, user.entId), isNull(carUsers.usrDeletedAt))),
  ]);

  /* Passenger: rich payload (name + email) cho UI hiển thị Avatar + dòng phụ.
   * Drivers vẫn được lọc ra khỏi danh sách hành khách — họ thường không tự
   * đặt chuyến cho mình. */
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
        title={tScr('title')}
        subtitle={tScr('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('trips'), href: '/trips' },
          { label: tA('new') },
        ]}
        back="/trips"
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href="/trips"><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      {/* Mobile: regular vertical scroll. Desktop (lg): no page-level scroll —
       * NewTripForm splits into 2 columns where the left column scrolls
       * internally and the map stays sticky on the right.
       * `overflow-x-hidden` everywhere prevents any inner-content overflow
       * from triggering a horizontal page scrollbar — datetime-local widgets
       * + long select options were the main culprits. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden lg:overflow-hidden px-4 md:px-7 py-4 md:py-5 lg:py-4">
        <NewTripForm
          passengers={passengerOptions}
          drivers={driverOptions}
          vehicles={vehicleOptions}
          currentUserId={user.userId}
          canCreateEntities={canCreateEntities}
        />
      </div>
    </>
  );
}
