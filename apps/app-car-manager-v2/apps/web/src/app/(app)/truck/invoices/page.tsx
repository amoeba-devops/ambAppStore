import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { Card, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@car-v2/ui';
import { TRUCK_INVOICE_TYPE_CODES, type TruckInvoiceTypeCode } from '@car-v2/shared/zod';
import { DebouncedSearchInput } from '@/components/inputs/debounced-search';
import { ParamDate } from '@/components/inputs/param-date';
import { ParamSelect } from '@/components/inputs/param-select';
import { PageHeader } from '@/components/layout/page-header';
import { RegionDeniedNotice } from '@/components/truck/region-denied-notice';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { formatDay } from '@/lib/format-day';
import { resolveRegionFilter, resolveVehicleScope } from '@/lib/auth/region-access';
import { getTruckInvoices } from '@/server/queries/truck-invoice.queries';
import { InvoiceRowActions } from './_components/invoice-row-actions';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/**
 * Hóa đơn — read-only aggregate of every invoice/receipt uploaded across 4
 * sources (REQ-20260921): trip-cost receipts, maintenance invoices, TRUCK
 * expense receipts, and (optional) fuel-invoice scans. STAFF only (the
 * /truck layout already bounces DRIVER). Region ACL mirrors the other 6
 * TRUCK screens (REQ-20260813).
 */
export default async function TruckInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    region?: string;
    region_denied?: string;
    vehicle?: string;
    type?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const t = await getTranslations('screens.truckInvoices');
  const tNav = await getTranslations('nav');
  const tCo = await getTranslations('company');
  const tRegion = await getTranslations('region');
  const tA = await getTranslations('actions');
  const locale = await getLocale();
  const loc = bcp47(locale);

  const { region, regions: permittedRegions } = await resolveRegionFilter(user, sp.region, sp);
  const { trucks, vehicleIds } = await resolveVehicleScope(user, sp.vehicle);
  const scopedTrucks = region ? trucks.filter((v) => v.cvhRegion === region) : trucks;
  const vehicleId = vehicleIds?.[0];
  const type =
    sp.type && (TRUCK_INVOICE_TYPE_CODES as readonly string[]).includes(sp.type)
      ? (sp.type as TruckInvoiceTypeCode)
      : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const result = await getTruckInvoices(user, {
    from: sp.from,
    to: sp.to,
    region,
    vehicle_id: vehicleId,
    type,
    q: sp.q,
    page,
  });

  const date = (d: Date) => formatDay(d, loc);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.from) params.set('from', sp.from);
    if (sp.to) params.set('to', sp.to);
    if (sp.region) params.set('region', sp.region);
    if (sp.vehicle) params.set('vehicle', sp.vehicle);
    if (sp.type) params.set('type', sp.type);
    if (sp.q) params.set('q', sp.q);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: result.total })}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('truckInvoices') }]}
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <RegionDeniedNotice code={sp.region_denied} />

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <DebouncedSearchInput placeholder={t('searchPlaceholder')} className="sm:w-64" clearLabel={tA('clear')} />
          <div className="flex items-center gap-2">
            <ParamDate paramName="from" value={sp.from} />
            <span className="text-text-faint text-sm">–</span>
            <ParamDate paramName="to" value={sp.to} />
          </div>
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
          <ParamSelect
            param="type"
            value={type}
            allLabel={t('allTypes')}
            options={result.availableTypes.map((c) => ({ value: c, label: t(`typeVal.${c}`) }))}
          />
        </div>

        {result.rows.length === 0 ? (
          <Card>
            <EmptyState icon={<Receipt />} title={t('emptyTitle')} description={t('emptyDesc')} />
          </Card>
        ) : (
          <>
            {/* Mobile card list. */}
            <ul className="md:hidden space-y-2.5">
              {result.rows.map((r, i) => (
                <li key={r.id} className="rounded-md border border-border bg-surface px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">{t(`typeVal.${r.typeCode}`)}</div>
                      <div className="text-xs text-text-faint truncate">{r.fileName}</div>
                    </div>
                    <InvoiceRowActions
                      item={{ key: r.id, name: r.fileName, mime: r.mime, sizeBytes: r.sizeBytes, url: r.signedUrl }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                    <span className="tabular">{date(r.date)}</span>
                    <span>{r.vehiclePlate ?? '—'} · {r.region ? tRegion(r.region) : '—'}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-faint">
                    {(page - 1) * result.pageSize + i + 1} · {r.uploadedByName ?? '—'}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table — columns per REQ-20260921: Số thứ tự / Ngày /
              * Khu vực / Phương tiện / Loại hóa đơn / Tên hóa đơn / Cập nhật
              * bởi / Action. */}
            <Card variant="outline" className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[52px]">{t('thStt')}</TableHead>
                    <TableHead>{t('thDate')}</TableHead>
                    <TableHead>{t('thRegion')}</TableHead>
                    <TableHead>{t('thVehicle')}</TableHead>
                    <TableHead>{t('thType')}</TableHead>
                    <TableHead>{t('thName')}</TableHead>
                    <TableHead>{t('thUpdatedBy')}</TableHead>
                    <TableHead className="w-[88px]">{t('thActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular text-text-faint">
                        {(page - 1) * result.pageSize + i + 1}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular text-text">{date(r.date)}</TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {r.region ? tRegion(r.region) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-text">
                        {r.vehiclePlate ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text">{t(`typeVal.${r.typeCode}`)}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-text-muted" title={r.fileName}>
                        {r.fileName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {r.uploadedByName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <InvoiceRowActions
                          item={{ key: r.id, name: r.fileName, mime: r.mime, sizeBytes: r.sizeBytes, url: r.signedUrl }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-text-muted">
                <Link
                  href={pageHref(page - 1)}
                  aria-disabled={page <= 1}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 hover:bg-surface-2 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('prev')}
                </Link>
                <span className="tabular">{t('pageOf', { page, totalPages })}</span>
                <Link
                  href={pageHref(page + 1)}
                  aria-disabled={page >= totalPages}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 hover:bg-surface-2 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
