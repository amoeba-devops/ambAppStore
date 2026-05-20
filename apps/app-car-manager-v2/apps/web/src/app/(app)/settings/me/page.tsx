import { getTranslations } from 'next-intl/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers } from '@car-v2/db/schema';
import { Card, CardContent } from '@car-v2/ui';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import { MeLanguageCard } from './_components/me-language-card';
import { MeLicenseCard } from './_components/me-license-card';
import { MeLogoutCard } from './_components/me-logout-card';
import { MeProfileCard } from './_components/me-profile-card';
import { MePushCard } from './_components/me-push-card';

/* "Me" page — profile + locale + logout for ALL roles, plus driver-only
 * license card. Driver gets the compact `<DriverPageHeader>`; admin/manager
 * land here too (from the sidebar/desktop nav) and get the standard
 * `<PageHeader>` to match the rest of their chrome. */
export default async function MePage() {
  const tCo  = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tMe  = await getTranslations('settings.me');
  const user = await getCurrentUser();

  /* Pull profile from the local mirror table (sync'd from AMA on first
   * passthrough). Inline query — single call site, no need for a query helper. */
  const profile = await db
    .select({
      id: carUsers.usrId,
      name: carUsers.usrName,
      email: carUsers.usrEmail,
      localRole: carUsers.usrLocalRole,
    })
    .from(carUsers)
    .where(and(
      eq(carUsers.usrId, user.userId),
      eq(carUsers.entId, user.entId),
      isNull(carUsers.usrDeletedAt),
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  /* Driver-only: pull license details so the License card can show class +
   * expiry. Admin/Manager don't have a driver record (`getDriverByUserId`
   * returns null) → card is suppressed below. */
  const driver = user.role === 'DRIVER'
    ? await getDriverByUserId(user.entId, user.userId)
    : null;

  /* Same PageHeader as every other page. Breadcrumbs differ slightly per role:
   * for admin/manager the path is Tenant > Settings > Me (since Settings is
   * the admin tenant config they're more likely to navigate from); for driver
   * it's Tenant > Today > Me (their canonical home). */
  const crumbs = user.role === 'DRIVER'
    ? [{ label: tCo('tenant') }, { label: tNav('today'), href: '/today' }, { label: tMe('title') }]
    : [{ label: tCo('tenant') }, { label: tNav('settings'), href: '/settings' }, { label: tMe('title') }];

  return (
    <>
      <PageHeader
        title={tMe('title')}
        subtitle={tMe('subtitle')}
        breadcrumbs={crumbs}
        back={user.role === 'DRIVER' ? '/today' : undefined}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4 max-w-2xl mx-auto w-full">
        <MeProfileCard
          name={profile?.name ?? user.userId.slice(0, 8)}
          email={profile?.email ?? null}
          role={user.role}
        />

        {driver && (
          <MeLicenseCard
            licenseNumber={driver.drvLicenseNumber}
            licenseClass={driver.drvLicenseClass}
            licenseExpiry={driver.drvLicenseExpiry}
            phone={driver.drvPhone}
            status={driver.drvStatus}
          />
        )}

        <MeLanguageCard />

        <MePushCard />

        <Card>
          <CardContent>
            <MeLogoutCard />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
