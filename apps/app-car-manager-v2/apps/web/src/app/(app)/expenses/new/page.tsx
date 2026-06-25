import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listDrivers } from '@/server/queries/drivers.queries';
import { listVehicles } from '@/server/queries/vehicles.queries';
import {
  ExpenseSubmitForm,
  type DriverOption,
  type VehicleOption,
} from './_components/expense-submit-form';

interface ExpenseNewPageProps {
  searchParams: Promise<{ tripId?: string }>;
}

/* Expense submit screen — shared by Driver and Admin/Manager.
 *
 * Entry points:
 *   - Driver:   `/today` FAB / trip-detail "Record expense" button.
 *               `back` lands them on `/today`.
 *   - Staff:    `/costs` PageHeader "+ Ghi nhận chi phí" button.
 *               `back` lands them on `/costs`.
 *
 * Pre-fetches the vehicle + driver picker options for the form (unless a
 * trip is already linked, in which case the form hides those pickers and
 * the server resolves the vehicle from the trip record). Drivers see the
 * vehicle picker only when no trip context is provided; the driver field
 * is auto-attached from their `car_drivers` row server-side.
 */
export default async function ExpenseNewPage({ searchParams }: ExpenseNewPageProps) {
  const tA   = await getTranslations('actions');
  const tCo  = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tE   = await getTranslations('expenses.submit');

  const user = await getCurrentUser();
  const { tripId } = await searchParams;
  const isStaff = user.role === 'ADMIN' || user.role === 'MANAGER';

  /* Vehicle/driver lookups are only needed when there's no trip context —
   * with a trip linked the server derives the vehicle and (for drivers)
   * auto-attaches the driver record. Saves two queries on every trip-linked
   * Driver submission. */
  let vehicles: VehicleOption[] = [];
  let drivers: DriverOption[] = [];
  if (!tripId) {
    const [vRows, dRows] = await Promise.all([
      listVehicles(user.entId),
      isStaff ? listDrivers(user.entId) : Promise.resolve([]),
    ]);
    vehicles = vRows
      .filter((v) => v.cvhStatus !== 'RETIRED')
      .map((v) => ({
        id: v.cvhId,
        plate: v.cvhPlateNumber,
        label: v.cvhModel ?? null,
      }));
    drivers = dRows.map((d) => ({
      id: d.drvId,
      /* drivers query returns CarDriver joined with usrName via `.user`.
       * Fall back to plate-style display if the user record is missing. */
      name: d.user.usrName ?? d.user.usrEmail ?? d.drvId.slice(0, 8),
    }));
  }

  /* Routing chrome adjusts by role — staff users land here from the cost
   * ledger and expect to bounce back there on cancel, drivers from the
   * Today screen. */
  const backHref = isStaff ? '/costs' : '/today';
  const backLabel = isStaff ? tNav('costs') : tNav('today');

  return (
    <>
      <PageHeader
        title={tE('title')}
        subtitle={tE('subtitle')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: backLabel, href: backHref },
          { label: tE('title') },
        ]}
        back={backHref}
        actions={
          <Button variant="ghost" size="md" asChild>
            <Link href={backHref}><ChevronLeft />{tA('back')}</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        <ExpenseSubmitForm
          tripId={tripId}
          role={user.role}
          vehicles={vehicles}
          drivers={drivers}
        />
      </div>
    </>
  );
}
