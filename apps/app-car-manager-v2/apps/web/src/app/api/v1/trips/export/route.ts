import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listTrips } from '@/server/queries/trips.queries';
import type { CarTripStatus } from '@car-v2/db/schema';
import { buildCsv, fmtDateTime, fmtDuration, fmtTripStatus } from '@/server/lib/csv';

/* Trip list CSV export — ent-scoped (listTrips filter by entId).
 * ADMIN + MANAGER only. Driver export would have a different shape (own trips)
 * and isn't requested by PRD MVP, redirect via 403.
 *
 * Query params: status, q, date (giống /trips page).
 * Max rows: hard-cap 1000 để tránh giật memory trên Render starter plan.
 */
export async function GET(req: NextRequest) {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);

  const sp = req.nextUrl.searchParams;
  const status = (sp.get('status') ?? 'all') as
    | CarTripStatus | 'all' | 'pending' | 'active' | 'completed';
  const q = sp.get('q')?.trim() || undefined;
  const dateRange = (sp.get('date') ?? 'all') as
    | 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'past';

  /* listTrips đã enforce ent_id + role visibility (Admin tất cả, Manager own). */
  const { items } = await listTrips({
    entId: actor.entId,
    role: actor.role,
    userId: actor.userId,
    status,
    q,
    dateRange,
    page: 1,
  });
  /* Re-fetch up to N pages to bypass per-call limit if needed — MVP simple. */
  const MAX_ROWS = 1000;
  const rows = items.slice(0, MAX_ROWS);

  const header = [
    'Mã chuyến',
    'Trạng thái',
    'Thời gian dự kiến',
    'Người sử dụng xe',
    'Tài xế',
    'Xe',
    'Điểm đón',
    'Điểm đến',
    'Thời lượng',
    'Mục đích',
    'Ngày tạo',
  ];
  const data = rows.map((t) => [
    t.trpRef,
    fmtTripStatus(t.trpStatus),
    fmtDateTime(t.trpScheduledAt),
    t.passengerName ?? '',
    t.driverName ?? '',
    t.vehiclePlate ?? '',
    t.trpPickupAddress,
    t.trpDropoffAddress,
    fmtDuration(t.trpDurationMinutes),
    t.trpPurpose ?? '',
    fmtDateTime(t.trpCreatedAt),
  ]);
  const csv = buildCsv(header, data);

  const filename = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
