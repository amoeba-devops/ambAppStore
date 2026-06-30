import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Plus, Truck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import type { CarVehicleStatus } from '@car-v2/db/schema';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { getLatestTruckDrivers } from '@/server/queries/truck-trips.queries';
import { getTruckFixedCostsByMonth } from '@/server/queries/truck-fixed-cost.queries';

const STATUS_TONE: Record<CarVehicleStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_USE: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
};

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export default async function TruckFleetPage() {
  const user = await getCurrentUser();
  const t = await getTranslations('screens.truckFleet');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => new Date(d).toLocaleDateString(loc);
  const REGIONS: readonly string[] = TRUCK_REGIONS;
  const regionLabel = (r: string | null) => (r && REGIONS.includes(r) ? tRegion(r) : (r ?? '—'));

  const trucks = await listVehicles(user.entId, 'active', 'TRUCK');
  const month = new Date().toISOString().slice(0, 7);
  const [drivers, fixedMap] = await Promise.all([
    getLatestTruckDrivers(user.entId),
    getTruckFixedCostsByMonth(user.entId, month),
  ]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: trucks.length })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckFleet') }]}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/truck/fleet/new">
              <Plus />
              {t('addTruck')}
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6">
        {trucks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Truck />}
              title={t('emptyTitle')}
              description={t('emptyDesc')}
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/truck/fleet/new">
                    <Plus />
                    {t('addTruck')}
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <Card variant="outline" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('thCode')}</TableHead>
                  <TableHead>{t('thPlate')}</TableHead>
                  <TableHead>{t('thModel')}</TableHead>
                  <TableHead>{t('thRegion')}</TableHead>
                  <TableHead className="text-right">{t('thConsumption')}</TableHead>
                  <TableHead className="text-right">{t('thDepreciation')}</TableHead>
                  <TableHead>{t('thDriver')}</TableHead>
                  <TableHead className="text-right">{t('thOdometer')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                  <TableHead>{t('thNotes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trucks.map((v) => {
                  const driver = drivers.get(v.cvhId) ?? null;
                  const deprec = fixedMap.get(v.cvhId)?.depreciation ?? 0;
                  return (
                    <ClickableTableRow key={v.cvhId} href={`/truck/fleet/${v.cvhId}/edit`}>
                      <TableCell className="whitespace-nowrap font-mono text-text-muted">{v.cvhCode ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono font-semibold text-text">{v.cvhPlateNumber}</TableCell>
                      <TableCell className="text-text">{v.cvhModel}</TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">{regionLabel(v.cvhRegion)}</TableCell>
                      <TableCell className="text-right tabular text-text-muted">
                        {v.cvhFuelQuota ? `${v.cvhFuelQuota} L/100km` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular text-text-muted">
                        {deprec > 0 ? vnd(deprec) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">{driver ?? '—'}</TableCell>
                      <TableCell className="text-right tabular">{v.cvhOdometerKm.toLocaleString(loc)} km</TableCell>
                      <TableCell>
                        <Badge tone={STATUS_TONE[v.cvhStatus]} size="sm">
                          {tStatus(v.cvhStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-text-faint tabular">
                        {v.cvhUpdatedAt ? date(v.cvhUpdatedAt) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-text-muted">{v.cvhNotes ?? '—'}</TableCell>
                    </ClickableTableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
