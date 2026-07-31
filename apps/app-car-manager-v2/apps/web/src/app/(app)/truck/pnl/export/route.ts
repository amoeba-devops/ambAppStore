import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { computeTruckPnl } from '@car-v2/core/truck';
import { buildExcel, excelResponse, type ExcelColumn } from '@/server/lib/excel';
import { buildReportPdf, buildTableContent, pdfResponse, type PdfColumn } from '@/server/lib/pdf';
import { exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { bcp47, monthName, resolveUiLocale } from '@/i18n/ui-locale';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** GET /truck/pnl/export?month=&format=xlsx|pdf — quick ad-hoc download of the
 * monthly P&L (all trucks) for the selected month. TRUCK-fleet staff only. */
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
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
  const region = url.searchParams.get('region') ?? undefined;

  const [row] = await computeTruckPnl(user, { region, months: [month] });
  const r = row ?? null;
  /* Row labels, headers, title and filename all follow the exporter's UI
   * language (exportContent.truckPnl). */
  const locale = await resolveUiLocale();
  const t = await getTranslations({ locale, namespace: 'exportContent.truckPnl' });
  const lines: { k: string; v: number }[] = r
    ? [
        { k: t('lineRevenue'), v: r.revenue },
        { k: t('lineFuel'), v: r.fuelCost },
        { k: t('lineToll'), v: r.tollFee },
        { k: t('lineExtra'), v: r.extraTotal },
        { k: t('lineVariable'), v: r.variableCost },
        { k: t('lineSalary'), v: r.salary },
        { k: t('lineDepreciation'), v: r.depreciation },
        { k: t('lineFixed'), v: r.fixedCost },
        { k: t('lineTrips'), v: r.tripCount },
        { k: t('lineNet'), v: r.netProfit },
      ]
    : [];
  const [y = '', mm = ''] = month.split('-');
  const m = String(Number(mm));
  const label = t('monthLabel', { m, mn: monthName(month, locale), y });
  const fileName = await exportFileName('screens.truckPnl', 'fileName', { y, mm, m }, `truck-pnl-${month}`);

  if (format === 'pdf') {
    const cols: PdfColumn[] = [
      { header: t('colItem'), key: 'k', width: '*' },
      { header: label, key: 'v', width: 160, alignment: 'right' },
    ];
    const rows = lines.map((l) => ({ k: l.k, v: l.v.toLocaleString(bcp47(locale)) }));
    const buffer = await buildReportPdf({
      title: t('title'),
      subtitle: label,
      sections: [{ title: t('sheetName'), content: buildTableContent(cols, rows) }],
    });
    return pdfResponse(buffer, `${fileName}.pdf`);
  }

  const cols: ExcelColumn[] = [
    { header: t('colItem'), key: 'k', width: 28 },
    { header: label, key: 'v', width: 20 },
  ];
  const buffer = buildExcel(await exportSheetName('exportContent.truckPnl', 'P&L'), cols, lines);
  return excelResponse(buffer, `${fileName}.xlsx`);
}
