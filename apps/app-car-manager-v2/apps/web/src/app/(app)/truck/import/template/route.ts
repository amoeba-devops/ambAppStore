import * as XLSX from 'xlsx';
import { TRUCK_IMPORT_HEADERS } from '@car-v2/shared/zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';

/**
 * GET /truck/import/template — downloads the CR-Vietnam-Truck-v1 .xlsx template
 * (17-column header row). The actual truck + driver are chosen in the import UI.
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

  const ws = XLSX.utils.aoa_to_sheet([[...TRUCK_IMPORT_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TripLog');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  /* Wrap in a plain Uint8Array — Node Buffer isn't a valid BodyInit under the
   * web lib types used here. */
  const body = new Uint8Array(buf);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="CR-Vietnam-Truck-v1.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
