import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Plus, Wrench } from 'lucide-react';
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
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { ClickableTableRow } from '@/components/clickable-table-row';
import { DateTimeCell } from '@/components/datetime-cell';
import { MonthPicker } from '@/components/inputs/month-picker';
import { ParamSelect } from '@/components/inputs/param-select';
import { ListRowActions } from '@/components/list-row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { RegionDeniedNotice } from '@/components/truck/region-denied-notice';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { formatDay, formatDayKey } from '@/lib/format-day';
import { resolveRegionFilter, resolveVehicleScope } from '@/lib/auth/region-access';
import { listTruckMaintenances, type TruckMaintenanceRow } from '@/server/queries/truck-maintenance.queries';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

type JobStatus = 'UPCOMING' | 'ACTIVE' | 'DONE';
const STATUS_TONE: Record<JobStatus, 'info' | 'warning' | 'neutral'> = {
  UPCOMING: 'info',
  ACTIVE: 'warning',
  DONE: 'neutral',
};

/** Derived, UI-only: where today (UTC day, same key trips use) sits vs the window. */
function statusOf(row: TruckMaintenanceRow, today: string): JobStatus {
  if (today < row.startDate) return 'UPCOMING';
  if (today > row.endDate) return 'DONE';
  return 'ACTIVE';
}

/** Inclusive day count of a 'YYYY-MM-DD' range. */
function dayCount(startIso: string, endIso: string): number {
  const a = Date.parse(`${startIso}T00:00:00Z`);
  const b = Date.parse(`${endIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Bảo trì — truck maintenance jobs (REQ-20260904). STAFF only (the /truck
 * layout already bounces DRIVER). Region ACL mirrors the fleet list: the
 * region filter + vehicle picker only offer what the viewer may see, and the
 * query is scoped to those trucks' ids.
 */
export default async function TruckMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; region?: string; region_denied?: string; vehicle?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const t = await getTranslations('screens.truckMaintenance');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month : undefined;
  const { region, regions: permittedRegions } = await resolveRegionFilter(user, sp.region, sp);
  /* `trucks` is already narrowed to the viewer's regions (REQ-20260813). */
  const { trucks } = await resolveVehicleScope(user, undefined);
  const scopedTrucks = region ? trucks.filter((v) => v.cvhRegion === region) : trucks;
  const vehicleId = sp.vehicle && scopedTrucks.some((v) => v.cvhId === sp.vehicle) ? sp.vehicle : undefined;

  const rows = await listTruckMaintenances(user.entId, {
    month,
    vehicleIds: vehicleId ? [vehicleId] : scopedTrucks.map((v) => v.cvhId),
  });

  const today = new Date().toISOString().slice(0, 10);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const date = (d: Date) => formatDay(d, loc);
  const day = (iso: string) => formatDayKey(iso, loc);
  const regionCodes: readonly string[] = TRUCK_REGIONS;
  const regionLabel = (r: string | null) => (r && regionCodes.includes(r) ? tRegion(r) : (r ?? '—'));
  /* Plain MM/YYYY — the subtitle string already carries the word "tháng". */
  const monthLabel = month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : '';
  /* Σ cost of the listed jobs — with a month filter this IS the month's
   * maintenance component of the dashboard's fixed cost (same scope). */
  const total = rows.reduce((a, r) => a + r.cost, 0);

  const subtitle = month ? t('subtitleMonth', { count: rows.length, month: monthLabel, total: vnd(total) }) : t('subtitle', { count: rows.length });

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={subtitle}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckMaintenance') }]}
        actions={
          <Button variant="accent" size="md" asChild>
            <Link href="/truck/maintenance/new">
              <Plus />
              {t('add')}
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <RegionDeniedNotice code={sp.region_denied} />
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <MonthPicker value={month ?? ''} />
          <ParamSelect
            param="region"
            value={region}
            allLabel={t('allRegions')}
            options={permittedRegions.map((r) => ({ value: r, label: tRegion(r) }))}
          />
          <ParamSelect
            param="vehicle"
            value={vehicleId}
            allLabel={t('allVehicles')}
            options={scopedTrucks.map((v) => ({ value: v.cvhId, label: v.cvhPlateNumber }))}
          />
        </div>

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wrench />}
              title={t('emptyTitle')}
              description={t('emptyDesc')}
              action={
                <Button variant="accent" size="md" asChild>
                  <Link href="/truck/maintenance/new">
                    <Plus />
                    {t('add')}
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {/* Mobile card list — 8 columns don't fit a phone. */}
            <ul className="md:hidden space-y-2.5">
              {rows.map((r) => {
                const st = statusOf(r, today);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/truck/maintenance/${r.id}/edit`}
                      className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-text truncate">{r.plate}</div>
                          <div className="text-xs text-text-faint truncate">
                            {r.model} · {regionLabel(r.region)}
                          </div>
                        </div>
                        <Badge tone={STATUS_TONE[st]} size="sm">{t(`status.${st}`)}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-text tabular">
                        {day(r.startDate)} – {day(r.endDate)}
                        <span className="text-xs text-text-muted"> · {t('days', { n: dayCount(r.startDate, r.endDate) })}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-text-muted">
                        <span className="tabular font-semibold text-text">{vnd(r.cost)}</span>
                        <span className="truncate">
                          {r.updatedByName ?? '—'} · {date(r.updatedAt ?? r.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table — columns per REQ: Ngày · Phương tiện · Thời gian
              * bảo trì · Chi phí · Cập nhật bởi · Cập nhật · Hành động. */}
            <Card variant="outline" className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[52px]">{t('thStt')}</TableHead>
                    <TableHead>{t('thDate')}</TableHead>
                    <TableHead>{t('thVehicle')}</TableHead>
                    <TableHead>{t('thPeriod')}</TableHead>
                    <TableHead className="text-right">{t('thCost')}</TableHead>
                    <TableHead>{t('thUpdatedBy')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                    <TableHead className="w-[88px]">{t('thActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const st = statusOf(r, today);
                    return (
                      <ClickableTableRow key={r.id} href={`/truck/maintenance/${r.id}/edit`}>
                        <TableCell className="tabular text-text-faint">{i + 1}</TableCell>
                        {/* "Ngày" = when the job was recorded (user decision Q4). */}
                        <TableCell className="whitespace-nowrap text-text">{date(r.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-mono font-semibold text-text">{r.plate}</div>
                          <div className="text-xs text-text-faint">
                            {r.model} · {regionLabel(r.region)}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="tabular text-text">
                            {day(r.startDate)} – {day(r.endDate)}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                            <span>{t('days', { n: dayCount(r.startDate, r.endDate) })}</span>
                            <Badge tone={STATUS_TONE[st]} size="sm">{t(`status.${st}`)}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular font-semibold text-text">{vnd(r.cost)}</TableCell>
                        <TableCell className="whitespace-nowrap text-text-muted">{r.updatedByName ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <DateTimeCell value={r.updatedAt ?? r.createdAt} locale={loc} />
                        </TableCell>
                        <TableCell>
                          <ListRowActions
                            editHref={`/truck/maintenance/${r.id}/edit`}
                            deleteId={r.id}
                            kind="maintenance"
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
