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
import { DateTimeCell } from '@/components/datetime-cell';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { ParamSelect } from '@/components/inputs/param-select';
import { ListRowActions } from '@/components/list-row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { listFleetDrivers } from '@/server/queries/drivers.queries';

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

const DRIVER_STATUSES: CarDriverStatus[] = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE'];

export default async function TruckDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const t = await getTranslations('screens.truckDrivers');
  const tA = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const date = (d: string | Date) => new Date(d).toLocaleDateString(loc);

  const allDrivers = await listFleetDrivers(user.entId, 'TRUCK');

  const q = sp.q?.trim().toLowerCase() || undefined;
  const fStatus = DRIVER_STATUSES.includes(sp.status as CarDriverStatus)
    ? (sp.status as CarDriverStatus)
    : undefined;
  const drivers = allDrivers.filter((d) => {
    if (q) {
      const hay = `${d.user.usrName ?? ''} ${d.drvPhone ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fStatus && d.drvStatus !== fStatus) return false;
    return true;
  });
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

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        {/* Search + filter bar (QA P2): tên/SĐT search, Khu vực / Phương tiện /
         * Trạng thái dropdowns — URL-driven so results are shareable. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-72" clearLabel={tA('clear')} />
          <ParamSelect
            param="status"
            value={fStatus}
            allLabel={t('allStatus')}
            options={DRIVER_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          />
        </div>
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
          <>
            {/* Mobile card list — the desktop roster is ~965px wide (10
             * columns) and forces horizontal scrolling on phones, so below md
             * each driver renders as a tappable card. */}
            <ul className="md:hidden space-y-2.5">
              {drivers.map((d) => (
                <li key={d.drvId}>
                  <Link
                    href={`/drivers/${d.drvId}`}
                    className="block rounded-md border border-border bg-surface px-4 py-3.5 active:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-text truncate">{d.user.usrName ?? '—'}</div>
                        {d.user.usrEmail && <div className="text-xs text-text-faint truncate">{d.user.usrEmail}</div>}
                      </div>
                      <Badge tone={STATUS_TONE[d.drvStatus]} size="sm">{t(`status.${d.drvStatus}`)}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                      <span className="font-mono text-text">{d.drvLicenseNumber}</span>
                      <span>· {d.drvLicenseClass}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-faint tabular">
                      <span>{t('thExpiry')}: {date(d.drvLicenseExpiry)}</span>
                      {d.drvPhone && <span>· {d.drvPhone}</span>}
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
                  <TableHead>{t('thDriver')}</TableHead>
                  <TableHead>{t('thLicense')}</TableHead>
                  <TableHead>{t('thClass')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thExpiry')}</TableHead>
                  <TableHead>{t('thPhone')}</TableHead>
                  <TableHead>{t('thEmergency')}</TableHead>
                  <TableHead>{t('thStatus')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('thUpdated')}</TableHead>
                  <TableHead>{t('thNotes')}</TableHead>
                  <TableHead className="w-[88px]">{t('thActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d, i) => (
                  <ClickableTableRow key={d.drvId} href={`/drivers/${d.drvId}`}>
                    <TableCell className="tabular text-text-faint">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-text">{d.user.usrName ?? '—'}</div>
                      {d.user.usrEmail && <div className="text-xs text-text-faint truncate">{d.user.usrEmail}</div>}
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
                    <TableCell className="whitespace-nowrap text-xs">
                      <DateTimeCell value={d.drvUpdatedAt} locale={loc} />
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-text-muted">{d.drvNotes ?? '—'}</TableCell>
                    <TableCell>
                      <ListRowActions
                        editHref={`/drivers/${d.drvId}/edit`}
                        deleteId={d.drvId}
                        kind="driver"
                        confirmText={t('deleteConfirm')}
                      />
                    </TableCell>
                  </ClickableTableRow>
                ))}
              </TableBody>
            </Table>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
