import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listAuditActors, listAuditForExport } from '@/server/queries/audit.queries';
import { buildCsv, fmtDateTime, fmtJsonAsKv } from '@/server/lib/csv';

/* Audit log CSV export — ent-scoped, ADMIN only.
 *
 * Same filter contract như /audit page:
 *   ?q=<text>      free-text search
 *   ?actor=<usrId> filter theo người thực hiện
 *
 * Actor ID phải pass whitelist (cùng listAuditActors check như page) để chặn
 * URL-injection xem audit của tenant khác.
 *
 * Hard cap 5000 rows / export — đủ cho ~3 tháng audit log normal usage. Nếu
 * cần nhiều hơn, user phải filter hẹp hơn (theo actor hoặc khoảng thời gian).
 */
export async function GET(req: NextRequest) {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN']);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q')?.trim() || undefined;
  const actorIdRaw = sp.get('actor')?.trim() || undefined;

  /* Whitelist actor ID — chỉ chấp nhận nếu có trong danh sách actor ent-scoped. */
  let actorId: string | undefined;
  if (actorIdRaw) {
    const actors = await listAuditActors(actor.entId);
    if (actors.some((a) => a.id === actorIdRaw)) actorId = actorIdRaw;
  }

  const rows = await listAuditForExport(actor.entId, { q, actorId, maxRows: 5000 });

  const header = [
    'Thời điểm',
    'Hành động',
    'Đối tượng',
    'Mã đối tượng',
    'Người thực hiện',
    'IP',
    'Trước thay đổi',
    'Sau thay đổi',
  ];
  /* aud_before/aud_after là JSON column — flatten thành "key=value; key2=value2"
   * thay vì dump nguyên `{"status":"PENDING",...}` ra cell. */
  const data = rows.map((r) => [
    fmtDateTime(r.audCreatedAt),
    r.audAction,
    r.audEntity,
    r.audEntityRef ?? r.audEntityId ?? '',
    r.actorName ?? (r.audUserId ? '' : 'system'),
    r.audIp ?? '',
    fmtJsonAsKv(r.audBefore),
    fmtJsonAsKv(r.audAfter),
  ]);
  const csv = buildCsv(header, data);

  const filename = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
