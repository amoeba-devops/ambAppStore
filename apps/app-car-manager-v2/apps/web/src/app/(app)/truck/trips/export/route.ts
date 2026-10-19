import * as XLSX from 'xlsx';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { allowedRegions, hasRegion } from '@/lib/auth/region-access';
import { TRUCK_REGIONS, TRUCK_TRIP_SHEET_COLUMNS, type TruckSheetColumn } from '@car-v2/shared/zod';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';
import { attachment, exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { resolveUiLocale } from '@/i18n/ui-locale';
import { truckTripSheetHeader } from '@/server/lib/truck-trip-sheet';

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
   * so Excel treats them as numbers. Headers + status in the exporter's UI
   * language — one language per file, like the R1 monthly template.
   *
   * Columns, labels and units come from TRUCK_TRIP_SHEET_COLUMNS, the layout
   * the import template is cut from too (BUG-261015) — an exported file
   * re-imports column for column. Cells are looked up BY KEY so a column can't
   * be added to the header without its value (the Record must be complete). */
  const hhmm = (d: Date | null) => (d ? new Date(d).toISOString().slice(11, 16) : '');
  const locale = await resolveUiLocale();
  const tStatus = await getTranslations({ locale, namespace: 'exportContent.status' });
  const header = await truckTripSheetHeader(locale, TRUCK_TRIP_SHEET_COLUMNS);
  type Trip = (typeof trips)[number];
  /* The 4 fixed cost types added REQ-20260916 (cleaning/repair/ferry/loading)
   * get their own columns — client decision 2026-09-17 to show each clearly
   * instead of folding into "Chi phí phát sinh". That column now carries only
   * the freeform extra-cost total (car_trip_extra_costs), same as extraNote. */
  const fixedFeesTotal = (t: Trip) =>
    t.breakdown.cleaningFee + t.breakdown.repairFee + t.breakdown.ferryFee + t.breakdown.loadingFee;
  /* This export mirrors the trip-log screen, so fuel is the trip's OWN
   * recorded spend (REQ-20260822) — litres × price as entered, not the
   * per-vehicle-month allocation. The allocated view is Chi phí & Lợi nhuận
   * and its own export. Revenue/toll/extra are unaffected (raw per trip);
   * totalCost/profit follow the actual fuel so the row adds up on its own. */
  const totalCost = (t: Trip) =>
    t.fuelActualCost + t.breakdown.tollFee + fixedFeesTotal(t) + t.breakdown.extraTotal;
  const cell: Record<TruckSheetColumn['key'], (t: Trip) => string | number> = {
    ref: (t) => t.ref,
    date: (t) => new Date(t.scheduledAt).toISOString().slice(0, 10),
    vehicle: (t) => t.plate ?? '',
    driver: (t) => t.driver ?? '',
    customer: (t) => t.customer ?? '',
    bol: (t) => t.bol ?? '',
    cdf: (t) => t.cdf ?? '',
    startTime: (t) => hhmm(t.startTime),
    endTime: (t) => hhmm(t.endTime),
    pickup: (t) => t.pickup ?? '',
    stopover: (t) => t.stopover ?? '',
    dropoff: (t) => t.dropoff ?? '',
    odoStart: (t) => t.startOdometer ?? '',
    odoEnd: (t) => t.endOdometer ?? '',
    kmTotal: (t) => t.km ?? '',
    toll: (t) => t.breakdown.tollFee,
    cleaning: (t) => t.breakdown.cleaningFee,
    repair: (t) => t.breakdown.repairFee,
    ferry: (t) => t.breakdown.ferryFee,
    loading: (t) => t.breakdown.loadingFee,
    otherAmount: (t) => t.breakdown.extraTotal,
    otherNote: (t) => t.extraNote ?? '',
    /* Full stored precision (trp_fuel_price / trp_fuel_liters are scale 2) so a
     * re-imported row rebuilds the same fuel cost — rounding to whole đồng /
     * 0.1 L shifted it (FIX-261019). */
    fuelPrice: (t) => Math.round(t.fuelActualPrice * 100) / 100,
    fuelLiters: (t) => Math.round(t.fuelActualLiters * 100) / 100,
    fuelActualCost: (t) => t.fuelActualCost,
    revenue: (t) => t.breakdown.revenue,
    totalCost,
    profit: (t) => t.breakdown.revenue - totalCost(t),
    status: (t) => tStatus(t.status),
    notes: (t) => t.notes ?? '',
  };
  const rows = trips.map((t) => TRUCK_TRIP_SHEET_COLUMNS.map((c) => cell[c.key](t)));

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
