import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import type { CarDriverStatus } from '@car-v2/db/schema';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listFleetDrivers } from '@/server/queries/drivers.queries';
import { getLatestVehiclesByDriver } from '@/server/queries/truck-trips.queries';

/**
 * Truck-department driver roster (REQ-20260622 audit G5; design table layout
 * REQ-20260629). Lists drivers with a TRUCK fleet membership. Rows link to the
 * shared driver detail.
 */
const STATUS_TONE: Record<CarDriverStatus, 'success' | 'info' | 'neutral' | 'warning'> = {
  AVAILABLE: 'success',
  ON_TRIP: 'info',
  OFF_DUTY: 'neutral',
  UNAVAILABLE: 'warning',
};

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export default async function TruckDriversPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckDrivers');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const date = (d: string | Date) => new Date(d).toLocaleDateString(loc);

  const [drivers, vehicleByDriver] = await Promise.all([
    listFleetDrivers(user.entId, 'TRUCK'),
    getLatestVehiclesByDriver(user.entId),
  ]);
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
          <Card variant="outline" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thDriver')}</TableHead>
                  <TableHead>{t('thVehicle')}</TableHead>
                  <TableHead>{t('thLicense')}</TableHead>
                  <TableHead>{t('thClass')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thExpiry')}</TableHead>
                  <TableHead>{t('thPhone')}</TableHead>
                  <TableHead>{t('thEmergency')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                  <TableHead>{t('thNotes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d) => (
                  <ClickableTableRow key={d.drvId} href={`/drivers/${d.drvId}`}>
                    <TableCell>
                      <div className="font-medium text-text">{d.user.usrName ?? '—'}</div>
                      {d.user.usrEmail && <div className="text-xs text-text-faint truncate">{d.user.usrEmail}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-text-muted">
                      {vehicleByDriver.get(d.drvId) ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-text">{d.drvLicenseNumber}</TableCell>
                    <TableCell className="text-text-muted">{d.drvLicenseClass}</TableCell>
                    <TableCell className="whitespace-nowrap tabular text-text-muted">{date(d.drvLicenseExpiry)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular text-text-muted">{d.drvPhone ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap tabular text-text-muted">{d.drvEmergencyContact ?? '—'}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[d.drvStatus]} size="sm">
                        {t(`status.${d.drvStatus}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-text-faint tabular">
                      {d.drvUpdatedAt ? date(d.drvUpdatedAt) : '—'}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-text-muted">{d.drvNotes ?? '—'}</TableCell>
                  </ClickableTableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
