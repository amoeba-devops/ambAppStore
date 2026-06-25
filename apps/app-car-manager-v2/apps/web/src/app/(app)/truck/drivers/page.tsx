import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronRight, IdCard, Plus } from 'lucide-react';
import { Badge, Button, Card } from '@car-v2/ui';
import type { CarDriverStatus } from '@car-v2/db/schema';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listFleetDrivers } from '@/server/queries/drivers.queries';

/**
 * Truck-department driver roster (REQ-20260622 audit G5). Lists drivers with a
 * TRUCK fleet membership — the design surfaces a per-department "Tài xế" screen
 * rather than the shared CCMS roster. Rows link to the existing driver detail.
 */
const STATUS_TONE: Record<CarDriverStatus, 'success' | 'info' | 'neutral' | 'warning'> = {
  AVAILABLE: 'success',
  ON_TRIP: 'info',
  OFF_DUTY: 'neutral',
  UNAVAILABLE: 'warning',
};

export default async function TruckDriversPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckDrivers');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tA = await getTranslations('actions');

  const drivers = await listFleetDrivers(user.entId, 'TRUCK');
  /* The /truck layout already blocks DRIVER role — anyone here is ADMIN/MANAGER. */
  const canCreate = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: drivers.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckDrivers') }]}
        actions={
          canCreate ? (
            <Button variant="accent" size="md" asChild>
              <Link href="/truck/drivers/new"><Plus />{t('addDriver')}</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        {drivers.length === 0 ? (
          <Card variant="outline" className="p-8 text-center space-y-4">
            <div className="text-sm text-text-muted">{t('empty')}</div>
            {canCreate && (
              <Button variant="accent" size="md" asChild>
                <Link href="/truck/drivers/new"><Plus />{t('addDriver')}</Link>
              </Button>
            )}
          </Card>
        ) : (
          <Card variant="outline" className="divide-y divide-border">
            {drivers.map((d) => (
              <Link
                key={d.drvId}
                href={`/drivers/${d.drvId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="h-9 w-9 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-text-faint">
                  <IdCard className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text truncate">{d.user.usrName ?? '—'}</div>
                  <div className="text-xs text-text-faint truncate">
                    {d.user.usrEmail ?? d.drvLicenseNumber}
                  </div>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <div className="text-xs text-text-muted">{t('license')}</div>
                  <div className="text-sm font-mono text-text">{d.drvLicenseNumber}</div>
                </div>
                <Badge tone={STATUS_TONE[d.drvStatus]} size="sm">
                  {t(`status.${d.drvStatus}`)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
