import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listEntityExpenses } from '@/server/queries/expenses.queries';
import {
  buildCsv,
  fmtAmount,
  fmtDate,
  fmtDateTime,
} from '@/server/lib/csv';
import { buildExcel, excelResponse, type ExcelColumn } from '@/server/lib/excel';
import { buildTablePdf, pdfResponse, type PdfColumn } from '@/server/lib/pdf';

/* Expense export — ent-scoped via `listEntityExpenses`. ADMIN + MANAGER
 * only. The approval flow was removed (every expense lands AUTO_APPROVED),
 * so the historic `?status=pending|approved|rejected` query param is gone
 * — the export always dumps the full ledger now.
 *
 * Query params: format (csv|xlsx|pdf), locale
 */
export async function GET(req: NextRequest) {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);

  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'csv') as 'csv' | 'xlsx' | 'pdf';
  const locale = sp.get('locale') ?? 'vi';

  // Load translations
  const t = await getTranslations({ locale, namespace: 'exportContent.expenses' });
  const tCat = await getTranslations({ locale, namespace: 'exportContent.categories' });
  const tExpStatus = await getTranslations({ locale, namespace: 'exportContent.expenseStatus' });

  // Helper to translate expense type - cast needed for dynamic i18n key
  const fmtType = (expType: string) => {
    try {
      return tCat(expType as Parameters<typeof tCat>[0]);
    } catch {
      return expType;
    }
  };

  // Helper to translate expense status - cast needed for dynamic i18n key
  const fmtStatus = (status: string) => {
    try {
      return tExpStatus(status as Parameters<typeof tExpStatus>[0]);
    } catch {
      return status;
    }
  };

  const items = await listEntityExpenses(actor.entId, 1000);
  const dateStr = new Date().toISOString().slice(0, 10);

  // Calculate total for summary
  const totalAmount = items.reduce((sum, e) => {
    const n = typeof e.expAmount === 'string' ? Number(e.expAmount) : e.expAmount;
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // CSV format (backwards compatible)
  if (format === 'csv') {
    const header = [
      t('colId'),
      t('colType'),
      t('colStatus'),
      t('colAmount'),
      t('colCurrency'),
      t('colOccurredAt'),
      t('colSubmittedAt'),
      t('colDriver'),
      t('colVehicle'),
      t('colTripRef'),
      t('colNote'),
    ];
    const data = items.map((e) => [
      e.expId.slice(0, 8).toUpperCase(),
      fmtType(e.expType),
      fmtStatus(e.expStatus),
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
    const filename = `expenses-${dateStr}.csv`;
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
      { header: t('colId'), key: 'id', width: 12 },
      { header: t('colType'), key: 'type', width: 14 },
      { header: t('colStatus'), key: 'status', width: 12 },
      { header: t('colAmount'), key: 'amount', width: 15 },
      { header: t('colCurrency'), key: 'currency', width: 8 },
      { header: t('colOccurredAt'), key: 'occurredAt', width: 14 },
      { header: t('colSubmittedAt'), key: 'submittedAt', width: 18 },
      { header: t('colDriver'), key: 'driver', width: 18 },
      { header: t('colVehicle'), key: 'vehicle', width: 12 },
      { header: t('colTripRef'), key: 'tripRef', width: 12 },
      { header: t('colNote'), key: 'note', width: 30 },
    ];

    const excelRows = items.map((e) => ({
      id: e.expId.slice(0, 8).toUpperCase(),
      type: fmtType(e.expType),
      status: fmtStatus(e.expStatus),
      amount: fmtAmount(e.expAmount, e.expCurrency),
      currency: e.expCurrency,
      occurredAt: fmtDate(e.expOccurredAt),
      submittedAt: fmtDateTime(e.expSubmittedAt),
      driver: e.driverName ?? '',
      vehicle: e.vehiclePlate ?? '',
      tripRef: e.tripRef ?? '',
      note: e.expNote ?? '',
    }));

    // Add summary row
    excelRows.push({
      id: '',
      type: '',
      status: t('totalLabel'),
      amount: fmtAmount(totalAmount, 'VND'),
      currency: 'VND',
      occurredAt: '',
      submittedAt: '',
      driver: '',
      vehicle: '',
      tripRef: '',
      note: t('countLabel', { count: items.length }),
    });

    const buffer = buildExcel(t('sheetName'), columns, excelRows);
    return excelResponse(buffer, `expenses-${dateStr}.xlsx`);
  }

  // PDF format
  if (format === 'pdf') {
    const pdfColumns: PdfColumn[] = [
      { header: t('colId'), key: 'id', width: 40 },
      { header: t('colType'), key: 'type', width: 55 },
      { header: t('colAmount'), key: 'amount', width: 70, alignment: 'right' },
      { header: t('colOccurredAt'), key: 'occurredAt', width: 55 },
      { header: t('colDriver'), key: 'driver', width: 70 },
      { header: t('colVehicle'), key: 'vehicle', width: 50 },
      { header: t('colNote'), key: 'note', width: '*' },
    ];

    const pdfRows = items.map((e) => ({
      id: e.expId.slice(0, 8).toUpperCase(),
      type: fmtType(e.expType),
      amount: fmtAmount(e.expAmount, e.expCurrency),
      occurredAt: fmtDate(e.expOccurredAt),
      driver: e.driverName ?? '',
      vehicle: e.vehiclePlate ?? '',
      note: e.expNote ?? '',
    }));

    const buffer = await buildTablePdf({
      title: t('title'),
      subtitle: t('subtitle', { date: dateStr, count: items.length, total: fmtAmount(totalAmount, 'VND') }),
      columns: pdfColumns,
      rows: pdfRows,
    });

    return pdfResponse(buffer, `expenses-${dateStr}.pdf`);
  }

  // Fallback - unsupported format
  return NextResponse.json(
    { success: false, error: 'Unsupported format. Use csv, xlsx, or pdf.' },
    { status: 400 },
  );
}
