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
  const region = url.searchParams.get('region') ?? undefined;
  const driver = url.searchParams.get('driver') ?? undefined;
  const statusRaw = url.searchParams.get('status');
  const status = statusRaw === 'complete' || statusRaw === 'ongoing' ? statusRaw : undefined;
  const trips = await listTruckTrips(user.entId, {
    q,
    month,
    vehicleId: vehicle,
    region,
    driverId: driver,
    status,
  });

  /* Detailed column template requested by the client (feedback #4) — mirrors
   * the monthly report's trip-log sheet. Times as HH:MM; money/km stay numeric
   * so Excel treats them as numbers. CDF (previously always blank) is filled,
   * and "Tổng chi phí" + "Ghi chú" are added. */
  const hhmm = (d: Date | null) => (d ? new Date(d).toISOString().slice(11, 16) : '');
  const header = [
    'Ref',
    'Ngày / Date',
    'Phương tiện / Vehicle',
    'Tài xế / Driver',
    'Khách hàng / Customer',
    'Số Bill / Bill No.',
    'Mã CDF / CDF Code',
    'Giờ BĐ / Start',
    'Giờ KT / End',
    'Nơi lấy hàng / From',
    'Nơi giao hàng / To',
    'ODO đầu (km)',
    'ODO cuối (km)',
    'Tổng KM / Total KM',
    'Cầu đường / Toll (đ)',
    'Phí khác / Other fee (đ)',
    'Tên phí khác / Fee name',
    'Giá dầu BQ / Fuel unit (đ/L)',
    'Lượng dầu / Litres (L)',
    'CP dầu / Fuel cost (đ)',
    'Doanh thu / Selling (đ)',
    'Tổng chi phí / Total cost (đ)',
    'Lợi nhuận / Profit (đ)',
    'Trạng thái / Status',
    'Ghi chú / Notes',
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
    t.dropoff ?? '',
    t.startOdometer ?? '',
    t.endOdometer ?? '',
    t.km ?? '',
    t.breakdown.tollFee,
    t.breakdown.extraTotal,
    t.extraNote ?? '',
    Math.round(t.fuelUnitPrice),
    Math.round(t.fuelLiters * 10) / 10,
    t.breakdown.fuelCost,
    t.breakdown.revenue,
    t.breakdown.totalCost,
    t.breakdown.profit,
    t.status,
    t.notes ?? '',
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
