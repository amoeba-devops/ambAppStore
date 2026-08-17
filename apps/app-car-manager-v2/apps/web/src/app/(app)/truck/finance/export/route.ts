import * as XLSX from 'xlsx';
import { getTranslations } from 'next-intl/server';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { allowedRegions, hasRegion, resolveVehicleScope } from '@/lib/auth/region-access';
import { listTruckFinanceTrips } from '@/server/queries/truck-finance.queries';
import { attachment, exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { resolveUiLocale } from '@/i18n/ui-locale';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** GET /truck/finance/export?month=&vehicles=&region= — per-trip cost & profit as
 * .xlsx. `vehicles` is a comma-separated list (REQ-20260814); `vehicle` (single)
 * still works for older links. Fuel/profit reflect the month-end model: official
 * once the month is closed, provisional while open. Sheet text + filename follow
 * the exporter's UI language.
 *
 * Route handlers bypass the /truck layout guard, so BOTH gates are re-checked
 * here: the fleet department, and the region ACL (REQ-20260813) — the latter was
 * missing until REQ-20260814, which let a region-narrowed user export every
 * region's trips. */
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
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') ?? '')
    ? (url.searchParams.get('month') as string)
    : currentMonth();
  const q = url.searchParams.get('q') ?? undefined;

  /* Region scope: an explicit `?region=` must be permitted (403 here, unlike the
   * pages which redirect); otherwise fall back to every region the user may see
   * so the "all regions" export stays inside the ACL. */
  const rawRegion = url.searchParams.get('region');
  const region =
    rawRegion && (TRUCK_REGIONS as readonly string[]).includes(rawRegion) ? rawRegion : undefined;
  if (region && !(await hasRegion(user, region))) {
    return new Response('Forbidden', { status: 403 });
  }
  const regions = await allowedRegions(user);

  /* Vehicle scope — ids outside the user's regions are dropped silently. */
  const { trucks, vehicleIds, isAll } = await resolveVehicleScope(
    user,
    url.searchParams.get('vehicles') ?? url.searchParams.get('vehicle') ?? undefined,
  );
  const rows = await listTruckFinanceTrips(user.entId, {
    month,
    vehicleIds,
    q,
    region,
    regions,
  });

  /* Sheet text follows the exporter's UI language (exportContent.truckFinance),
   * same source as the filename. Dates stay ISO so Excel parses them anywhere. */
  const t = await getTranslations({
    locale: await resolveUiLocale(),
    namespace: 'exportContent.truckFinance',
  });
  const header = [
    t('colDate'), t('colVehicle'), t('colDriver'), t('colCustomer'), t('colKm'),
    t('colToll'), t('colExtra'), t('colUnitPrice'), t('colLiters'), t('colFuelCost'),
    t('colRevenue'), t('colProfit'), t('colStatus'),
  ];
  const body = rows.map((r) => [
    new Date(r.scheduledAt).toISOString().slice(0, 10),
    r.plate ?? '',
    r.driver ?? '',
    r.customer ?? '',
    r.km,
    r.toll,
    r.extra,
    r.unitPrice,
    Math.round(r.liters * 10) / 10,
    r.fuelCost,
    r.revenue,
    r.profit,
    r.finalized ? t('statusDone') : t('statusOpen'),
  ]);

  /* Scope line above the table (REQ-20260814 BL-4) — with a subset selected the
   * file is no longer "the month", and nothing else on the sheet says so. */
  const plateOf = (id: string) => trucks.find((v) => v.cvhId === id)?.cvhPlateNumber ?? id;
  const scopeLine = isAll
    ? t('scopeAll', { total: String(trucks.length) })
    : t('scopeVehicles', {
        n: String(vehicleIds?.length ?? 0),
        total: String(trucks.length),
        plates: (vehicleIds ?? []).map(plateOf).join(', '),
      });

  const ws = XLSX.utils.aoa_to_sheet([[scopeLine], [], header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, await exportSheetName('exportContent.truckFinance', 'TruckFinance'));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const [y = '', mm = ''] = month.split('-');
  const m = String(Number(mm));
  const fileName = await exportFileName(
    'screens.truckFinance',
    'fileName',
    { y, mm, m },
    `truck-finance-${month}`,
  );

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': attachment(`${fileName}.xlsx`),
      'Cache-Control': 'no-store',
    },
  });
}
