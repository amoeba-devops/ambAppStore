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
    /* Same rule as the on-screen list this export mirrors: fuel = the trip's
     * own recorded litres × unit price (tracking reality), never the month-end
     * allocation — that belongs to the finance screens' own export. */
    fuelSource: 'recorded',
  });

  /* One column per trip field the UI shows (I/O parity 2026-08-18): the list
   * table's columns (incl. Khu vực) + the trip form's fields (times, route
   * with waypoint, ODO, fuel, costs, revenue, documents, notes) — headers use
   * the SAME wording as those screens, nothing renamed or invented. Times as
   * HH:MM; money/km stay numeric so Excel treats them as numbers. Headers +
   * status come from exportContent.truckTrips in the exporter's UI language —
   * one language per file, like the R1 monthly template. Status mirrors the
   * list's two states (Đã/Chưa hoàn thành), not the car module's 7. */
  const hhmm = (d: Date | null) => (d ? new Date(d).toISOString().slice(11, 16) : '');
  const locale = await resolveUiLocale();
  const tCol = await getTranslations({ locale, namespace: 'exportContent.truckTrips' });
  const tRegion = await getTranslations({ locale, namespace: 'region' });
  const regionLabel = (r: string | null) =>
    r && (TRUCK_REGIONS as readonly string[]).includes(r) ? tRegion(r as (typeof TRUCK_REGIONS)[number]) : (r ?? '');
  const header = [
    tCol('colRef'),
    tCol('colDate'),
    tCol('colVehicle'),
    tCol('colRegion'),
    tCol('colDriver'),
    tCol('colCustomer'),
    tCol('colBol'),
    tCol('colCdf'),
    tCol('colStart'),
    tCol('colEnd'),
    tCol('colPickup'),
    tCol('colWaypoint'),
    tCol('colDropoff'),
    tCol('colOdoStart'),
    tCol('colOdoEnd'),
    tCol('colKm'),
    tCol('colFuelLiters'),
    tCol('colFuelPrice'),
    tCol('colFuelCost'),
    tCol('colToll'),
    tCol('colExtra'),
    tCol('colExtraName'),
    tCol('colRevenue'),
    tCol('colTotalCost'),
    tCol('colProfit'),
    tCol('colStatus'),
    tCol('colNotes'),
  ];
  const rows = trips.map((t) => [
    t.ref,
    new Date(t.scheduledAt).toISOString().slice(0, 10),
    t.plate ?? '',
    regionLabel(t.region),
    t.driver ?? '',
    t.customer ?? '',
    t.bol ?? '',
    t.cdf ?? '',
    hhmm(t.startTime),
    hhmm(t.endTime),
    t.pickup ?? '',
    t.waypoint ?? '',
    t.dropoff ?? '',
    t.startOdometer ?? '',
    t.endOdometer ?? '',
    t.km ?? '',
    t.fuelLiters,
    t.fuelUnitPrice,
    t.breakdown.fuelCost,
    t.breakdown.tollFee,
    t.breakdown.extraTotal,
    t.extraNote ?? '',
    t.breakdown.revenue,
    t.breakdown.totalCost,
    t.breakdown.profit,
    t.status === 'COMPLETED' ? tCol('statusDone') : tCol('statusOpen'),
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
