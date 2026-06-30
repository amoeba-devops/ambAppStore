import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { listTruckTrips } from '@/server/queries/truck-trips.queries';

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
  const statusRaw = url.searchParams.get('status');
  const status = statusRaw === 'complete' || statusRaw === 'ongoing' ? statusRaw : undefined;
  const trips = await listTruckTrips(user.entId, { q, month, vehicleId: vehicle, status });

  const header = ['Ref', 'Ngày', 'Phương tiện', 'Tài xế', 'Khách hàng', 'BOL', 'CDF', 'Km', 'Nhiên liệu', 'Cầu đường', 'Khác', 'Doanh thu', 'Lợi nhuận', 'Trạng thái'];
  const rows = trips.map((t) => [
    t.ref,
    new Date(t.scheduledAt).toISOString().slice(0, 10),
    t.plate ?? '',
    t.driver ?? '',
    t.customer ?? '',
    t.bol ?? '',
    '',
    t.km ?? '',
    t.breakdown.fuelCost,
    t.breakdown.tollFee,
    t.breakdown.extraTotal,
    t.breakdown.revenue,
    t.breakdown.profit,
    t.status,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TruckTrips');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="truck-trips${month ? `-${month}` : ''}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
