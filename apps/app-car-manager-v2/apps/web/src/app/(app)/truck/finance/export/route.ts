import * as XLSX from 'xlsx';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { listTruckFinanceTrips } from '@/server/queries/truck-finance.queries';
import { attachment, exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { resolveUiLocale } from '@/i18n/ui-locale';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** GET /truck/finance/export?month=&vehicle= — per-trip cost & profit as .xlsx.
 * Fuel/profit reflect the month-end model: official once the month is closed,
 * provisional while open. Sheet text + filename follow the exporter's UI
 * language. Gated to TRUCK-fleet staff (route handlers bypass the /truck layout
 * guard, so re-check here). */
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
  const vehicle = url.searchParams.get('vehicle') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const rows = await listTruckFinanceTrips(user.entId, { month, vehicleId: vehicle, q });

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

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
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
