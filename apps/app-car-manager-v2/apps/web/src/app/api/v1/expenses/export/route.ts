import { NextResponse } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listEntityExpenses } from '@/server/queries/expenses.queries';
import {
  buildCsv,
  fmtAmount,
  fmtDate,
  fmtDateTime,
  fmtExpenseStatus,
  fmtExpenseType,
} from '@/server/lib/csv';

/* Expense CSV export — ent-scoped via `listEntityExpenses`. ADMIN + MANAGER
 * only. The approval flow was removed (every expense lands AUTO_APPROVED),
 * so the historic `?status=pending|approved|rejected` query param is gone
 * — the export always dumps the full ledger now. */
export async function GET() {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);

  const items = await listEntityExpenses(actor.entId, 1000);

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
  ]);
  const csv = buildCsv(header, data);

  const filename = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
