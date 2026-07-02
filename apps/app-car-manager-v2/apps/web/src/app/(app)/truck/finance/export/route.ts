import * as XLSX from 'xlsx';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { listTruckFinanceTrips } from '@/server/queries/truck-finance.queries';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** GET /truck/finance/export?month=&vehicle= — per-trip cost & profit as .xlsx.
 * Fuel/profit reflect the month-end model: official once the month is closed,
 * provisional ("Tạm tính") while open. Gated to TRUCK-fleet staff (route
 * handlers bypass the /truck layout guard, so re-check here). */
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

  const header = [
    'Ngày', 'Phương tiện', 'Tài xế', 'Khách hàng', 'Km',
    'Phí cầu đường', 'Phát sinh', 'Đơn giá', 'Lít', 'Phí xăng',
    'Doanh thu', 'Lợi nhuận', 'Trạng thái',
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
    r.finalized ? 'Đã chốt' : 'Tạm tính',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TruckFinance');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="truck-finance-${month}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
