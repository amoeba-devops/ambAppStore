import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listAuditActors, listAuditForExport } from '@/server/queries/audit.queries';
import { buildCsv, fmtDateTime, fmtJsonAsKv } from '@/server/lib/csv';
import { buildExcel, excelResponse, type ExcelColumn } from '@/server/lib/excel';
import { buildTablePdf, pdfResponse, type PdfColumn } from '@/server/lib/pdf';

/* Audit log export — ent-scoped, ADMIN only.
 *
 * Same filter contract như /audit page:
 *   ?q=<text>      free-text search
 *   ?actor=<usrId> filter theo người thực hiện
 *   ?format=csv|xlsx|pdf  export format (default: csv)
 *   ?locale=vi|en|ko  language for headers (default: vi)
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
  const format = (sp.get('format') ?? 'csv') as 'csv' | 'xlsx' | 'pdf';
  const locale = sp.get('locale') ?? 'vi';

  /* Whitelist actor ID — chỉ chấp nhận nếu có trong danh sách actor ent-scoped. */
  let actorId: string | undefined;
  if (actorIdRaw) {
    const actors = await listAuditActors(actor.entId);
    if (actors.some((a) => a.id === actorIdRaw)) actorId = actorIdRaw;
  }

  const rows = await listAuditForExport(actor.entId, { q, actorId, maxRows: 5000 });

  /* Load translations for headers */
  const t = await getTranslations({ locale, namespace: 'exportContent.audit' });

  const dateStr = new Date().toISOString().slice(0, 10);

  /* Helper to map rows to export data */
  const mapRow = (r: (typeof rows)[number]) => ({
    timestamp: fmtDateTime(r.audCreatedAt),
    action: r.audAction,
    entity: r.audEntity,
    ref: r.audEntityRef ?? r.audEntityId ?? '',
    actor: r.actorName ?? (r.audUserId ? '' : 'system'),
    ip: r.audIp ?? '',
    before: fmtJsonAsKv(r.audBefore),
    after: fmtJsonAsKv(r.audAfter),
  });

  // CSV format
  if (format === 'csv') {
    const header = [
      t('colTimestamp'),
      t('colAction'),
      t('colEntity'),
      t('colRef'),
      t('colActor'),
      t('colIp'),
      t('colBefore'),
      t('colAfter'),
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

    const filename = `audit-${dateStr}.csv`;
    const encodedFilename = encodeURIComponent(filename);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Excel format
  if (format === 'xlsx') {
    const columns: ExcelColumn[] = [
      { header: t('colTimestamp'), key: 'timestamp', width: 18 },
      { header: t('colAction'), key: 'action', width: 25 },
      { header: t('colEntity'), key: 'entity', width: 15 },
      { header: t('colRef'), key: 'ref', width: 15 },
      { header: t('colActor'), key: 'actor', width: 20 },
      { header: t('colIp'), key: 'ip', width: 15 },
      { header: t('colBefore'), key: 'before', width: 40 },
      { header: t('colAfter'), key: 'after', width: 40 },
    ];

    const excelRows = rows.map(mapRow);
    const buffer = buildExcel(t('sheetName'), columns, excelRows);
    return excelResponse(buffer, `audit-${dateStr}.xlsx`);
  }

  // PDF format
  if (format === 'pdf') {
    try {
      /* PDF có giới hạn độ rộng — chỉ hiện các cột quan trọng */
      const pdfColumns: PdfColumn[] = [
        { header: t('colTimestamp'), key: 'timestamp', width: 70 },
        { header: t('colAction'), key: 'action', width: 90 },
        { header: t('colEntity'), key: 'entity', width: 60 },
        { header: t('colRef'), key: 'ref', width: 60 },
        { header: t('colActor'), key: 'actor', width: 80 },
        { header: t('colIp'), key: 'ip', width: '*' },
      ];

      const pdfRows = rows.map(mapRow);

      const buffer = await buildTablePdf({
        title: t('title'),
        subtitle: t('subtitle', { date: dateStr, count: rows.length }),
        columns: pdfColumns,
        rows: pdfRows,
      });

      return pdfResponse(buffer, `audit-${dateStr}.pdf`);
    } catch (error) {
      console.error('[audit/export] PDF generation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'PDF generation failed',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }

  // Fallback - unsupported format
  return NextResponse.json(
    { success: false, error: 'Unsupported format. Use csv, xlsx, or pdf.' },
    { status: 400 },
  );
}
