import * as XLSX from 'xlsx';
import { getTranslations } from 'next-intl/server';
import { TRUCK_TEMPLATE_ORDER } from '@car-v2/shared/zod';
import { resolveUiLocale } from '@/i18n/ui-locale';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { attachment, exportFileName, exportSheetName } from '@/server/lib/export-file-name';

/**
 * GET /truck/import/template — downloads the CR-Vietnam-Truck-v1 .xlsx template
 * (18-column header row). The actual truck + driver are chosen in the import UI.
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

  /* Header row in the downloader's language, from the one shared column
   * glossary (REQ-20260824) — the same words the trip list, the mapper and the
   * export use. Order is fixed by TRUCK_TEMPLATE_ORDER so a file made from an
   * older template still lines up. Units live next to the label where they
   * matter, e.g. "Lượng nhiên liệu (L)". */
  const tCol = await getTranslations({ locale: await resolveUiLocale(), namespace: 'columns.truck' });
  const unit: Partial<Record<(typeof TRUCK_TEMPLATE_ORDER)[number], string>> = {
    odoStart: tCol('unitKm'),
    odoEnd: tCol('unitKm'),
    fuelLiters: tCol('unitLitre'),
    fuelPrice: tCol('unitPricePerL'),
  };
  const headers = TRUCK_TEMPLATE_ORDER.map((k) => {
    const label = tCol(k as Parameters<typeof tCol>[0]);
    const u = unit[k];
    return u ? `${label} (${u})` : label;
  });
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, await exportSheetName('screens.truckImport', 'TripLog'));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  /* Wrap in a plain Uint8Array — Node Buffer isn't a valid BodyInit under the
   * web lib types used here. */
  const body = new Uint8Array(buf);
  const fileName = await exportFileName('screens.truckImport', 'fileName', {}, 'CR-Vietnam-Truck-v1');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': attachment(`${fileName}.xlsx`),
      'Cache-Control': 'no-store',
    },
  });
}
