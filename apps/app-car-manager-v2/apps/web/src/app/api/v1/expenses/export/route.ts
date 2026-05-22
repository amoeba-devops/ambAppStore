import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import {
  listPendingExpenses,
  type ExpenseStatusFilter,
} from '@/server/queries/expenses.queries';
import {
  buildCsv,
  fmtAmount,
  fmtDate,
  fmtDateTime,
  fmtExpenseStatus,
  fmtExpenseType,
} from '@/server/lib/csv';

/* Expense CSV export — ent-scoped (listPendingExpenses filter by entId).
 * ADMIN + MANAGER only.
 */
export async function GET(req: NextRequest) {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);

  const sp = req.nextUrl.searchParams;
  const statusRaw = sp.get('status') ?? 'pending';
  const status = (['pending', 'approved', 'rejected', 'all'].includes(statusRaw)
    ? statusRaw
    : 'pending') as ExpenseStatusFilter;

  const items = await listPendingExpenses(actor.entId, status, 1000);

  const header = [
    'Mã chi phí',
    'Loại',
    'Trạng thái',
    'Số tiền',
    'Tiền tệ',
    'Ngày phát sinh',
    'Thời điểm gửi',
    'Tài xế',
    'Xe',
    'Mã chuyến',
    'Ghi chú',
    'Ghi chú duyệt',
    'Thời điểm duyệt',
  ];
  const data = items.map((e) => [
    e.expId.slice(0, 8).toUpperCase(),
    fmtExpenseType(e.expType),
    fmtExpenseStatus(e.expStatus),
    fmtAmount(e.expAmount, e.expCurrency),
    e.expCurrency,
    fmtDate(e.expOccurredAt),
    fmtDateTime(e.expSubmittedAt),
    e.driverName ?? '',
    e.vehiclePlate ?? '',
    e.tripRef ?? '',
    e.expNote ?? '',
    e.expReviewNote ?? '',
    fmtDateTime(e.expReviewedAt),
  ]);
  const csv = buildCsv(header, data);

  const filename = `expenses-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
