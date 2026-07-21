import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { computeTruckPnl } from '@car-v2/core/truck';
import { buildExcel, excelResponse, type ExcelColumn } from '@/server/lib/excel';
import { buildReportPdf, buildTableContent, pdfResponse, type PdfColumn } from '@/server/lib/pdf';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
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
  const lines: { k: string; v: number }[] = r
    ? [
        { k: 'Doanh thu', v: r.revenue },
        { k: 'Phí nhiên liệu', v: r.fuelCost },
        { k: 'Phí cầu đường', v: r.tollFee },
        { k: 'Chi phí phát sinh', v: r.extraTotal },
        { k: 'Chi phí biến đổi', v: r.variableCost },
        { k: 'Lương (theo xe)', v: r.salary },
        { k: 'Khấu hao', v: r.depreciation },
        { k: 'Bảo hiểm', v: r.insurance },
        { k: 'Chi phí cố định', v: r.fixedCost },
        { k: 'Số chuyến', v: r.tripCount },
        { k: 'Lợi nhuận ròng', v: r.netProfit },
      ]
    : [];
  const label = monthLabel(month);

  if (format === 'pdf') {
    const cols: PdfColumn[] = [
      { header: 'Hạng mục', key: 'k', width: '*' },
      { header: label, key: 'v', width: 160, alignment: 'right' },
    ];
    const rows = lines.map((l) => ({ k: l.k, v: l.v.toLocaleString('vi-VN') }));
    const buffer = await buildReportPdf({
      title: 'Chi phí & Lợi nhuận',
      subtitle: label,
      sections: [{ title: 'P&L', content: buildTableContent(cols, rows) }],
    });
    return pdfResponse(buffer, `truck-pnl-${month}.pdf`);
  }

  const cols: ExcelColumn[] = [
    { header: 'Hạng mục', key: 'k', width: 28 },
    { header: label, key: 'v', width: 20 },
  ];
  const buffer = buildExcel('P&L', cols, lines);
  return excelResponse(buffer, `truck-pnl-${month}.xlsx`);
}
