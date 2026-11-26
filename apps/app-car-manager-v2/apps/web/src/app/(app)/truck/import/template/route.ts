import { TRUCK_TEMPLATE_COLUMNS } from '@car-v2/shared/zod';
import { resolveUiLocale } from '@/i18n/ui-locale';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { attachment, exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { truckTripSheetHeader } from '@/server/lib/truck-trip-sheet';
import { buildTruckTripWorkbook } from '@/server/lib/truck-trip-workbook';

/**
 * GET /truck/import/template — downloads the CR-Vietnam-Truck-v1 .xlsx template
 * (header row only). The actual truck + driver are chosen in the import UI.
 *
 * Filename + tab name follow the downloader's UI language, but keep the
 * `CR-Vietnam-Truck-v1` format token up front: the user guide and
 * `truckImport.templateDesc` name that token, and re-upload doesn't depend on
 * either string (the parser walks every sheet and matches the header row).
 */
export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  if (user.role === 'DRIVER' || !(await hasFleet(user, 'TRUCK'))) {
    return new Response('Forbidden', { status: 403 });
  }

  /* Same columns, order, labels, units AND data types as the trip-log export,
   * minus the export-only computed ones (BUG-261015) — see
   * TRUCK_TRIP_SHEET_COLUMNS. Header row in the downloader's language; every
   * column pre-formatted by its type (date dd/mm/yyyy, time hh:mm, money
   * #,##0, codes as text) so typed values land as the same type the export
   * writes. */
  const body = await buildTruckTripWorkbook({
    sheetName: await exportSheetName('screens.truckImport', 'TripLog'),
    header: await truckTripSheetHeader(await resolveUiLocale(), TRUCK_TEMPLATE_COLUMNS),
    types: TRUCK_TEMPLATE_COLUMNS.map((c) => c.type),
  });
  const fileName = await exportFileName('screens.truckImport', 'fileName', {}, 'CR-Vietnam-Truck-v1');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': attachment(`${fileName}.xlsx`),
      'Cache-Control': 'no-store',
    },
  });
}
