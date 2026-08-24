import * as XLSX from 'xlsx';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { allowedRegions, hasRegion } from '@/lib/auth/region-access';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';
import { attachment, exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { resolveUiLocale } from '@/i18n/ui-locale';

/** GET /truck/trips/export?q=&month= — exports the (filtered) truck trip log
 * as .xlsx. Gated to TRUCK-fleet staff (route handlers bypass the /truck layout
 * guard, so we re-check here). */
export async function GET(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  if (user.role === 'DRIVER' || !(await hasFleet(user, 'TRUCK'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const month = url.searchParams.get('month') ?? undefined;
  const vehicle = url.searchParams.get('vehicle') ?? undefined;
  const region = url.searchParams.get('region') ?? undefined;
  const driver = url.searchParams.get('driver') ?? undefined;
  const statusRaw = url.searchParams.get('status');
  const status = statusRaw === 'complete' || statusRaw === 'ongoing' ? statusRaw : undefined;

  /* Region ACL (REQ-20260813) — the export must not become a way around the
   * list's region scope. */
  if (region && !(await hasRegion(user, region))) {
    return new Response('Forbidden', { status: 403 });
  }
  const permitted = await allowedRegions(user);
  const trips = await listTruckTrips(user.entId, {
    q,
    month,
    vehicleId: vehicle,
    region,
    regions: permitted.length < TRUCK_REGIONS.length ? permitted : undefined,
    driverId: driver,
    status,
  });

  /* Detailed column template requested by the client (feedback #4) — mirrors
   * the monthly report's trip-log sheet. Times as HH:MM; money/km stay numeric
   * so Excel treats them as numbers. Headers + status come from
   * exportContent.truckTrips in the exporter's UI language — one language per
   * file, like the R1 monthly template (no more "Ngày / Date" pairs). */
  const hhmm = (d: Date | null) => (d ? new Date(d).toISOString().slice(11, 16) : '');
  const locale = await resolveUiLocale();
  const tCol = await getTranslations({ locale, namespace: 'columns.truck' });
  const tExp = await getTranslations({ locale, namespace: 'exportContent.truckTrips' });
  const tStatus = await getTranslations({ locale, namespace: 'exportContent.status' });
  /* Nhãn cột lấy từ glossary dùng chung `columns.truck` (REQ-20260824) nên
   * template / màn Import / danh sách chuyến / file này gọi CÙNG một tên cho
   * cùng một thứ; đơn vị gắn kèm ở file vì người đọc file cần nó. Các cột chỉ
   * có ở file (tính toán) vẫn giữ định danh "thực tế" của REQ-20260822. */
  const money = tCol('unitMoney');
  const withUnit = (label: string, unit: string) => `${label} (${unit})`;
  const header = [
    tCol('ref'),
    tCol('date'),
    tCol('vehicle'),
    tCol('driver'),
    tCol('customer'),
    tCol('bol'),
    tCol('cdf'),
    tCol('startTime'),
    tCol('endTime'),
    tCol('pickup'),
    tCol('stopover'),
    tCol('dropoff'),
    withUnit(tCol('odoStart'), tCol('unitKm')),
    withUnit(tCol('odoEnd'), tCol('unitKm')),
    tCol('kmTotal'),
    withUnit(tCol('toll'), money),
    withUnit(tCol('otherAmount'), money),
    tCol('otherNote'),
    withUnit(tCol('fuelPrice'), tCol('unitPricePerL')),
    withUnit(tCol('fuelLiters'), tCol('unitLitre')),
    withUnit(tCol('fuelActualCost'), money),
    withUnit(tCol('revenue'), money),
    /* Hai nhãn này đã tự mang đơn vị trong i18n ("… (đ)") — không bọc withUnit
     * nữa, kẻo thành "(đ) (đ)". */
    tExp('colTotalCost'),
    tExp('colProfit'),
    tCol('status'),
    tCol('notes'),
  ];
  const rows = trips.map((t) => [
    t.ref,
    new Date(t.scheduledAt).toISOString().slice(0, 10),
    t.plate ?? '',
    t.driver ?? '',
    t.customer ?? '',
    t.bol ?? '',
    t.cdf ?? '',
    hhmm(t.startTime),
    hhmm(t.endTime),
    t.pickup ?? '',
    t.stopover ?? '',
    t.dropoff ?? '',
    t.startOdometer ?? '',
    t.endOdometer ?? '',
    t.km ?? '',
    t.breakdown.tollFee,
    t.breakdown.extraTotal,
    t.extraNote ?? '',
    /* This export mirrors the trip-log screen, so fuel is the trip's OWN
     * recorded spend (REQ-20260822) — litres × price as entered, not the
     * per-vehicle-month allocation. The allocated view is Chi phí & Lợi nhuận
     * and its own export. Revenue/toll/extra are unaffected (raw per trip);
     * totalCost/profit follow the actual fuel so the row adds up on its own. */
    Math.round(t.fuelActualPrice),
    Math.round(t.fuelActualLiters * 10) / 10,
    t.fuelActualCost,
    t.breakdown.revenue,
    t.fuelActualCost + t.breakdown.tollFee + t.breakdown.extraTotal,
    t.breakdown.revenue - (t.fuelActualCost + t.breakdown.tollFee + t.breakdown.extraTotal),
    tStatus(t.status),
    t.notes ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, await exportSheetName('exportContent.truckTrips', 'TruckTrips'));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  /* Filename in the exporter's language; the month suffix is dropped when the
   * list isn't filtered by month (export covers every month). */
  const [y = '', mm = ''] = (month ?? '').split('-');
  const m = mm ? String(Number(mm)) : '';
  const fileName = await exportFileName(
    'screens.truckTrips',
    month ? 'fileNameMonth' : 'fileName',
    { y, mm, m },
    `truck-trips${month ? `-${month}` : ''}`,
  );

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': attachment(`${fileName}.xlsx`),
      'Cache-Control': 'no-store',
    },
  });
}
