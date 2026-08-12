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
import { DateTimeCell } from '@/components/datetime-cell';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { ParamSelect } from '@/components/inputs/param-select';
import { ListRowActions } from '@/components/list-row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { getDriverNamesByIds } from '@/server/queries/drivers.queries';
import { parseAmount } from '@car-v2/core/truck';

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

const VEHICLE_STATUSES: CarVehicleStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

export default async function TruckFleetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const t = await getTranslations('screens.truckFleet');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tStatus = await getTranslations('vehicles.status');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const REGIONS: readonly string[] = TRUCK_REGIONS;
  const regionLabel = (r: string | null) => (r && REGIONS.includes(r) ? tRegion(r) : (r ?? '—'));

  const allTrucks = await listVehicles(user.entId, 'active', 'TRUCK');

  const q = sp.q?.trim().toLowerCase() || undefined;
  const fRegion = sp.region && REGIONS.includes(sp.region) ? sp.region : undefined;
  const fStatus = VEHICLE_STATUSES.includes(sp.status as CarVehicleStatus)
    ? (sp.status as CarVehicleStatus)
    : undefined;
  const trucks = allTrucks.filter((v) => {
    if (q && !v.cvhPlateNumber.toLowerCase().includes(q)) return false;
    if (fRegion && v.cvhRegion !== fRegion) return false;
    if (fStatus && v.cvhStatus !== fStatus) return false;
    return true;
  });

  /* Resolve default-driver names in one batch (no N+1) so the roster can show
   * each truck's assigned driver; unlinked trucks fall back to an empty cell. */
  const driverNames = await getDriverNamesByIds(
    user.entId,
    [...new Set(trucks.map((v) => v.cvhDefaultDriverId).filter((id): id is string => !!id))],
  );
  const driverName = (v: (typeof trucks)[number]) =>
    v.cvhDefaultDriverId ? (driverNames.get(v.cvhDefaultDriverId) ?? null) : null;

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

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* Search + filter bar (QA P2) — URL-driven, same pattern as trip log. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-72" clearLabel={tA('clear')} />
          <ParamSelect
            param="region"
            value={fRegion}
            allLabel={t('allRegions')}
            options={REGIONS.map((r) => ({ value: r, label: tRegion(r) }))}
          />
          <ParamSelect
            param="status"
            value={fStatus}
            allLabel={t('allStatus')}
            options={VEHICLE_STATUSES.map((s) => ({ value: s, label: tStatus(s) }))}
          />
        </div>
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
          <>
            {/* Mobile card list — the desktop table has 11 columns (~790px) and
             * forces horizontal scrolling on phones, so below md each truck
             * renders as a tappable card surfacing the key fields. */}
            <ul className="md:hidden space-y-2.5">
              {trucks.map((v) => (
                  <li key={v.cvhId}>
                    <Link
                      href={`/truck/fleet/${v.cvhId}/edit`}
                      className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-text truncate">{v.cvhPlateNumber}</div>
                          <div className="text-xs text-text-faint truncate">
                            {v.cvhCode ? <span className="font-mono">{v.cvhCode} · </span> : null}
                            {v.cvhModel}
                          </div>
                        </div>
                        <Badge tone={STATUS_TONE[v.cvhStatus]} size="sm">{tStatus(v.cvhStatus)}</Badge>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                        <span className="text-text">{regionLabel(v.cvhRegion)}</span>
                        <span className="tabular">· {v.cvhOdometerKm.toLocaleString(loc)} km</span>
                        {driverName(v) ? <span className="truncate">· {driverName(v)}</span> : null}
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>

            {/* Desktop table */}
            <Card variant="outline" className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px]">{t('thStt')}</TableHead>
                  <TableHead>{t('thCode')}</TableHead>
                  <TableHead>{t('thPlate')}</TableHead>
                  <TableHead>{t('thModel')}</TableHead>
                  <TableHead>{t('thDriver')}</TableHead>
                  <TableHead>{t('thRegion')}</TableHead>
                  <TableHead className="text-right">{t('thConsumption')}</TableHead>
                  <TableHead className="text-right">{t('thDepreciation')}</TableHead>
                  <TableHead className="text-right">{t('thOdometer')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                  <TableHead>{t('thNotes')}</TableHead>
                  <TableHead className="w-[88px]">{t('thActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trucks.map((v, i) => {
                  /* Depreciation source of truth is the vehicle's own
                   * "Khấu hao/tháng" (cvh_depreciation) — same value the P&L
                   * fallback uses. (Was reading the retired manual fixed-cost
                   * table, so it always showed "—".) */
                  const deprec = Math.round(parseAmount(v.cvhDepreciation));
                  return (
                    <ClickableTableRow key={v.cvhId} href={`/truck/fleet/${v.cvhId}/edit`}>
                      <TableCell className="tabular text-text-faint">{i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-text-muted">{v.cvhCode ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono font-semibold text-text">{v.cvhPlateNumber}</TableCell>
                      <TableCell className="text-text">{v.cvhModel}</TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {driverName(v) ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">{regionLabel(v.cvhRegion)}</TableCell>
                      <TableCell className="text-right tabular text-text-muted">
                        <div>{v.cvhFuelQuota ? `${v.cvhFuelQuota} L/100km` : '—'}</div>
                        {v.cvhFuelPrice ? (
                          <div className="text-xs text-text-faint">{vnd(Math.round(Number(v.cvhFuelPrice)))}/L</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular text-text-muted">
                        {deprec > 0 ? vnd(deprec) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular">{v.cvhOdometerKm.toLocaleString(loc)} km</TableCell>
                      <TableCell>
                        <Badge tone={STATUS_TONE[v.cvhStatus]} size="sm">
                          {tStatus(v.cvhStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <DateTimeCell value={v.cvhUpdatedAt} locale={loc} />
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-text-muted">{v.cvhNotes ?? '—'}</TableCell>
                      <TableCell>
                        <ListRowActions
                          editHref={`/truck/fleet/${v.cvhId}/edit`}
                          deleteId={v.cvhId}
                          kind="vehicle"
                          confirmText={t('form.deleteConfirm')}
                        />
                      </TableCell>
                    </ClickableTableRow>
                  );
                })}
              </TableBody>
            </Table>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
