import 'server-only';
import ExcelJS from 'exceljs';
import type { TruckReportExport } from '@/server/queries/truck-report-export.queries';
import { TRUCK_REPORT_LOGO_PNG_BASE64, TRUCK_REPORT_LOGO_SIZE } from './truck-report-logo';

/**
 * "Tổng kết chi phí tháng / Monthly cost summary" — a pixel-faithful rebuild of
 * the client template (BaoCao_DoiXe_T5_2026_Report.xlsx, REQ-20260713): same
 * Arial type, navy (#1F3A5F) section bands, alternating row shading, borders,
 * number formats, and the Cargo Rush logo top-right. Structure (fixed rows):
 *
 *   1     logo (floats top-right)
 *   2-4   company name / address / tel-fax
 *   7     title band
 *   8-9   date · month · prepared-by
 *   11-13 KPI tiles (xe / chuyến / km / lợi nhuận)
 *   15-16 A. Doanh thu
 *   18-25 B. Chi phí (6 dòng + Σ)
 *   27-29 C. Kết quả (lợi nhuận, margin)
 *   31-34 D. Hiệu quả nhiên liệu
 *   36-37 E. header · 38..  per-truck rows · then TỔNG
 *
 * Numbers come from getTruckReportExport (same core as the finance screen).
 * Aggregates use real Excel formulas (SUM / IFERROR) with cached results, so the
 * file both shows values immediately and recalculates when edited. Invariants:
 * C25 = SUM(C19:C24); C28 = C16 − C25 = KPI profit; the E-table TỔNG row equals
 * the A/B/C blocks column-for-column.
 */

const FONT = 'Arial';

/* Palette (exact ARGB from the template). */
const NAVY = 'FF1F3A5F';
const WHITE = 'FFFFFFFF';
const GRAY = 'FF6B7280';
const DARK = 'FF374151';
const INK = 'FF111827';
const BLUE = 'FF185FA5';
const GREEN = 'FF3B6D11';
const RED = 'FFA32D2D';
const AMBER = 'FF854F0B';
const MUTE_IT = 'FF9CA3AF';
const BLACK = 'FF000000';

const LIGHT = 'FFF0F4F8'; // zebra band + KPI fill
const META_FILL = 'FFF8F9FA';
const HEAD_FILL = 'FFF1F5F9'; // E-table column header
const TOTAL_FILL = 'FFEEF2FF';
const GREEN_FILL = 'FFEAF3DE';
const RED_FILL = 'FFFCEBEB';
const AMBER_FILL = 'FFFEF3C7';

const B_LIGHT = 'FFDEE2E6'; // hairline under data rows
const B_META = 'FFC8CAD0';
const B_INDIGO = 'FFA5B4FC'; // total-row box

const MONEY = '#,##0';
const MONEY_DONG = '#,##0" đ";(#,##0)" đ"';
const LITERS = '#,##0" L"';
const LITERS1 = '#,##0.0" L"';
const KM_PER_L = '0.00" km/L"';
const KM_PER_L_PLAIN = '0.00';
const DONG_KM = '#,##0" đ/km"';
const PERCENT = '0.0%';
const DASH = '—';

/* Company header + logo follow the client template VERBATIM (user decision
 * 2026-07-14): these are fixed, not tenant data — only app-mappable info
 * (người lập, ngày lập, month/region, every number) is dynamic. */
const COMPANY_NAME = 'Cargo Rush International Co., Ltd';
const COMPANY_ADDRESS = '77 Nguyễn Trọng Lội, Phường Tân Sơn Nhất, TP.HCM, Vietnam';
const COMPANY_CONTACT = 'Tel: 84 8 3948 0931~2     Fax: 84 8 3848 5337';

const COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const LAST = 'L';

type Align = 'left' | 'center' | 'right';

/** Translator bound to `exportContent.truckMonthlySummary` — the file's TEXT
 * follows the GENERATOR's UI language (REQ follow-up 2026-07-14). vi renders
 * the client template verbatim; en/ko translate the labels. The language is
 * baked into the stored file at generation time (downloads share one file). */
export type SummaryTranslator = (key: string, values?: Record<string, string | number>) => string;

export interface MonthlySummaryLabels {
  monthLabel: string;
  regionLabel: string;
  generatedAt: Date;
  /** BCP-47 tag for in-file number/date rendering (vi-VN / en-US / ko-KR). */
  bcp47: string;
  t: SummaryTranslator;
}
interface Style {
  fmt?: string;
  align?: Align;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  box?: boolean; // full border (total rows); else bottom hairline
  borderColor?: string;
  noBorder?: boolean;
}

export async function buildTruckMonthlySummaryWorkbook(
  data: TruckReportExport,
  labels: MonthlySummaryLabels,
): Promise<Buffer> {
  const { t, bcp47 } = labels;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Amoeba Car Manager';
  const ws = wb.addWorksheet(t('sheetName'), {
    properties: { showGridLines: false },
    views: [{ showGridLines: false }],
  });

  const set = (addr: string, value: ExcelJS.CellValue, st: Style = {}) => {
    const cell = ws.getCell(addr);
    if (value !== null && value !== undefined) cell.value = value;
    cell.font = {
      name: FONT,
      size: st.size ?? 8.5,
      bold: st.bold,
      italic: st.italic,
      color: { argb: st.color ?? DARK },
    };
    cell.alignment = { vertical: 'middle', horizontal: st.align ?? 'left' };
    if (st.fmt) cell.numFmt = st.fmt;
    if (st.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } };
    if (!st.noBorder) {
      const c = st.borderColor ?? B_LIGHT;
      const side = { style: 'thin' as const, color: { argb: c } };
      cell.border = st.box ? { top: side, bottom: side, left: side, right: side } : { bottom: side };
    }
    return cell;
  };

  /* Apply a band (fill + border) across B..L so shading and underline span the
   * full width even under merged value cells. */
  const band = (r: number, st: Style) => {
    for (const c of COLS) set(`${c}${r}`, null, { ...st, align: 'left' });
  };

  /* Section value line: label in B + value merged across C:L. */
  const line = (r: number, label: string, value: ExcelJS.CellValue, st: Style) => {
    band(r, { fill: st.fill, box: st.box, borderColor: st.borderColor });
    set(`B${r}`, label, { size: st.size, bold: st.bold, color: st.color ?? DARK, fill: st.fill, box: st.box, borderColor: st.borderColor, align: 'left' });
    ws.mergeCells(`C${r}:${LAST}${r}`);
    set(`C${r}`, value, { ...st, align: 'right' });
  };

  const sectionHeader = (r: number, text: string) => {
    for (const c of COLS) set(`${c}${r}`, null, { fill: NAVY, noBorder: true });
    ws.mergeCells(`B${r}:${LAST}${r}`);
    set(`B${r}`, text, { bold: true, size: 9, color: WHITE, fill: NAVY, align: 'left', noBorder: true });
  };

  /* ── Column widths & row heights (exact) ─────────────────────────────────── */
  const widths: Record<string, number> = {
    A: 2, B: 36, C: 11.14, D: 8.86, E: 8.86, F: 11.43, G: 10.86, H: 8.71, I: 5, J: 11.43, K: 6.43, L: 9.57, M: 2,
  };
  for (const [col, w] of Object.entries(widths)) ws.getColumn(col).width = w;
  const heights: Record<number, number> = {
    1: 7.5, 2: 19.5, 3: 13.5, 4: 13.5, 5: 9.75, 6: 7.5, 7: 24, 8: 15.75, 9: 18, 10: 7.5,
    11: 13.5, 12: 21.75, 13: 15.75, 14: 7.5, 15: 18, 16: 15.75, 17: 6, 18: 18,
    19: 15.75, 20: 15.75, 21: 15.75, 22: 15.75, 23: 15.75, 24: 15.75, 25: 18, 26: 6,
    27: 18, 28: 18, 29: 15.75, 30: 7.5, 31: 18, 32: 15.75, 33: 15.75, 34: 15.75, 35: 7.5, 36: 18, 37: 18,
  };
  for (const [r, h] of Object.entries(heights)) ws.getRow(Number(r)).height = h;

  const gen = labels.generatedAt.toLocaleDateString(bcp47, { day: '2-digit', month: '2-digit', year: 'numeric' });

  /* ── Logo (floats top-right) + company header ────────────────────────────── */
  const logoId = wb.addImage({
    /* Node Buffer works at runtime; cast bridges ExcelJS's ArrayBuffer-based
     * Buffer type vs Node 22's Buffer<ArrayBuffer>. */
    buffer: Buffer.from(TRUCK_REPORT_LOGO_PNG_BASE64, 'base64') as unknown as ExcelJS.Buffer,
    extension: 'png',
  });
  ws.addImage(logoId, {
    tl: { col: 10, row: 1 } as ExcelJS.Anchor,
    ext: { width: TRUCK_REPORT_LOGO_SIZE.width, height: TRUCK_REPORT_LOGO_SIZE.height },
    editAs: 'oneCell',
  });
  ws.mergeCells('B2:K2');
  set('B2', COMPANY_NAME, { size: 12, bold: true, color: NAVY, noBorder: true });
  ws.mergeCells('B3:K3');
  set('B3', COMPANY_ADDRESS, { size: 8, color: GRAY, noBorder: true });
  ws.mergeCells('B4:K4');
  set('B4', COMPANY_CONTACT, { size: 8, color: GRAY, noBorder: true });

  /* ── Title band ──────────────────────────────────────────────────────────── */
  for (const c of COLS) set(`${c}7`, null, { fill: NAVY, noBorder: true });
  ws.mergeCells(`B7:${LAST}7`);
  set('B7', t('title'), { size: 13, bold: true, color: WHITE, fill: NAVY, align: 'center', noBorder: true });

  /* ── Meta rows 8-9 ───────────────────────────────────────────────────────── */
  ws.mergeCells('B8:I8');
  set('B8', null, { fill: META_FILL, borderColor: B_LIGHT, align: 'center' });
  ws.mergeCells('J8:L8');
  set('J8', t('datePrepared', { date: gen }), { size: 8, color: GRAY, fill: META_FILL, align: 'right', borderColor: B_LIGHT });
  ws.mergeCells('B9:D9');
  set('B9', t('monthField'), { size: 8, color: GRAY, fill: LIGHT, align: 'right', borderColor: B_META });
  ws.mergeCells('E9:H9');
  set('E9', `${labels.monthLabel} · ${labels.regionLabel}`, { size: 9, bold: true, color: NAVY, fill: LIGHT, align: 'left', borderColor: B_META });
  ws.mergeCells('I9:L9');
  set('I9', t('preparedBy', { name: data.header.preparedBy ?? DASH }), { size: 8, color: GRAY, fill: LIGHT, align: 'right', borderColor: B_META });

  /* ── KPI tiles (rows 11-13) ──────────────────────────────────────────────── */
  const s = data.summary;
  const kpi = (c1: string, c2: string, label: string, value: ExcelJS.CellValue, fmt: string | undefined, valColor: string, sub: string) => {
    for (const r of [11, 12, 13]) ws.mergeCells(`${c1}${r}:${c2}${r}`);
    set(`${c1}11`, label, { size: 7.5, color: GRAY, fill: LIGHT, align: 'center', borderColor: B_LIGHT });
    set(`${c1}12`, value, { size: 14, bold: true, color: valColor, fill: LIGHT, align: 'center', fmt, borderColor: B_LIGHT });
    set(`${c1}13`, sub, { size: 7.5, italic: true, color: MUTE_IT, fill: LIGHT, align: 'center', borderColor: B_LIGHT });
  };
  const avgKm = Math.round(s.avgKmPerActive).toLocaleString(bcp47);
  const avgTrips = s.avgTripsPerActive.toLocaleString(bcp47, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  kpi('B', 'C', t('kpiTrucks'), t('kpiTrucksValue', { n: s.truckCount }), undefined, BLUE,
    t('kpiTrucksSub', { a: s.activeCount, m: s.maintenanceCount }));
  kpi('D', 'E', t('kpiTrips'), s.tripCount, MONEY, DARK, t('kpiTripsSub', { x: avgTrips }));
  kpi('F', 'G', t('kpiKm'), s.totalKm, MONEY, DARK, t('kpiKmSub', { x: avgKm }));
  kpi('H', 'J', t('kpiProfit'), s.netProfit, MONEY_DONG, s.netProfit >= 0 ? GREEN : RED,
    t('kpiMarginSub', { x: (s.margin * 100).toFixed(1) }));
  for (const r of [11, 12, 13]) ws.mergeCells(`K${r}:L${r}`);
  for (const r of [11, 12, 13]) set(`K${r}`, null, { fill: LIGHT, borderColor: B_LIGHT });

  /* ── A. Doanh thu ────────────────────────────────────────────────────────── */
  sectionHeader(15, t('secRevenue'));
  line(16, t('lineRevenue'), data.totals.revenue, { fill: WHITE, fmt: MONEY, color: GREEN, bold: true });

  /* ── B. Chi phí ──────────────────────────────────────────────────────────── */
  sectionHeader(18, t('secExpenses'));
  const insurance = data.totals.fixedOther - data.totals.depreciation;
  const expenses: [number, string, number][] = [
    [19, `    ${t('lineFuel')}`, data.totals.fuel],
    [20, `    ${t('lineToll')}`, data.totals.toll],
    [21, `    ${t('lineExtra')}`, data.totals.extra],
    [22, `    ${t('lineSalary')}`, data.totals.salary],
    [23, `    ${t('lineDepreciation')}`, data.totals.depreciation],
    [24, `    ${t('lineOther')}`, insurance],
  ];
  for (const [r, label, val] of expenses) {
    line(r, label, val, { fill: r % 2 === 0 ? LIGHT : WHITE, fmt: MONEY, color: DARK });
  }
  const totalExpenses = data.totals.fuel + data.totals.toll + data.totals.extra + data.totals.salary + data.totals.depreciation + insurance;
  line(25, t('lineTotalExpenses'),
    { formula: 'SUM(C19:C24)', result: totalExpenses } as ExcelJS.CellValue,
    { fill: TOTAL_FILL, fmt: MONEY, color: RED, bold: true, size: 9, borderColor: B_INDIGO });
  set('B25', t('lineTotalExpenses'), { fill: TOTAL_FILL, color: INK, bold: true, size: 9, borderColor: B_INDIGO });

  /* ── C. Kết quả ──────────────────────────────────────────────────────────── */
  sectionHeader(27, t('secResult'));
  const netColor = data.totals.net >= 0 ? GREEN : RED;
  line(28, t('lineGrossProfit'),
    { formula: 'C16-C25', result: data.totals.net } as ExcelJS.CellValue,
    { fill: WHITE, fmt: MONEY, color: netColor, bold: true, size: 9 });
  set('B28', t('lineGrossProfit'), { fill: WHITE, color: INK, bold: true, size: 9 });
  line(29, t('lineMargin'),
    { formula: 'IFERROR(C28/C16,"")', result: data.totals.revenue !== 0 ? data.totals.net / data.totals.revenue : '' } as ExcelJS.CellValue,
    { fill: LIGHT, fmt: PERCENT, color: netColor });

  /* ── D. Hiệu quả nhiên liệu ──────────────────────────────────────────────── */
  sectionHeader(31, t('secFuel'));
  const totalLiters = data.vehicles.reduce((a, v) => a + v.liters, 0);
  const kmPerL = totalLiters > 0 ? Math.round((s.totalKm / totalLiters) * 100) / 100 : 0;
  const costPerKm = s.totalKm > 0 ? Math.round(data.totals.fuel / s.totalKm) : 0;
  line(32, t('lineTotalFuel'), Math.round(totalLiters * 10) / 10, { fill: WHITE, fmt: LITERS1, color: DARK });
  line(33, t('lineKmPerL'), kmPerL, { fill: LIGHT, fmt: KM_PER_L, color: GREEN });
  line(34, t('lineFuelPerKm'), costPerKm, { fill: WHITE, fmt: DONG_KM, color: AMBER });

  /* ── E. Chi tiết từng xe ─────────────────────────────────────────────────── */
  sectionHeader(36, t('secPerTruck'));
  const eHead: [string, string, Align][] = [
    ['B', t('thDriver'), 'left'], ['C', t('thPlate'), 'center'], ['D', t('thTrips'), 'center'],
    ['E', t('thKm'), 'center'], ['F', t('thRevenue'), 'center'], ['G', t('thCost'), 'center'],
    ['H', t('thFuel'), 'center'], ['I', t('thKmPerL'), 'center'], ['J', t('thProfit'), 'center'],
    ['K', t('thMargin'), 'center'], ['L', t('thStatus'), 'center'],
  ];
  for (const [c, text, align] of eHead) {
    set(`${c}37`, text, { size: 8, bold: true, color: GRAY, fill: HEAD_FILL, align, borderColor: B_META });
  }

  const first = 38;
  data.vehicles.forEach((v, i) => {
    const r = first + i;
    ws.getRow(r).height = 19.5;
    const bg = i % 2 === 0 ? LIGHT : WHITE;
    const idle = v.status === 'MAINTENANCE' || v.tripCount === 0;
    const rowColor = v.status === 'MAINTENANCE' ? AMBER : v.net >= 0 ? GREEN : RED;
    const who = [v.driver, v.model].filter(Boolean).join(' · ') || DASH;
    set(`B${r}`, who, { size: 8, color: GRAY, fill: bg, align: 'left' });
    set(`C${r}`, v.plate, { size: 8, color: GRAY, fill: bg, align: 'center' });
    set(`D${r}`, idle ? DASH : v.tripCount, { fmt: idle ? undefined : MONEY, color: BLACK, fill: bg, align: 'center' });
    set(`E${r}`, idle ? DASH : v.km, { fmt: idle ? undefined : MONEY, color: BLACK, fill: bg, align: idle ? 'center' : 'right' });
    set(`F${r}`, idle ? DASH : v.revenue, { fmt: idle ? undefined : MONEY, color: BLACK, fill: bg, align: idle ? 'center' : 'right' });
    set(`G${r}`, v.costTotal, { fmt: MONEY, color: BLACK, fill: bg, align: 'right' });
    set(`H${r}`, idle ? DASH : Math.round(v.liters * 10) / 10, { fmt: idle ? undefined : LITERS, color: BLACK, fill: bg, align: 'center' });
    set(`I${r}`, idle || v.liters <= 0 ? DASH : Math.round((v.km / v.liters) * 100) / 100, {
      fmt: idle || v.liters <= 0 ? undefined : KM_PER_L_PLAIN, bold: !idle, color: idle ? GRAY : rowColor, fill: bg, align: 'center',
    });
    if (idle) {
      set(`J${r}`, v.net, { fmt: MONEY, bold: true, color: rowColor, fill: bg, align: 'right' });
      set(`K${r}`, DASH, { color: GRAY, fill: bg, align: 'center' });
    } else {
      set(`J${r}`, { formula: `F${r}-G${r}`, result: v.net } as ExcelJS.CellValue, { fmt: MONEY, bold: true, color: rowColor, fill: bg, align: 'right' });
      set(`K${r}`, { formula: `IFERROR(J${r}/F${r},"")`, result: v.revenue !== 0 ? v.net / v.revenue : '' } as ExcelJS.CellValue, { fmt: PERCENT, color: rowColor, fill: bg, align: 'center' });
    }
    const stFill = v.status === 'MAINTENANCE' ? AMBER_FILL : v.status === 'PROFIT' ? GREEN_FILL : RED_FILL;
    const stText =
      v.status === 'MAINTENANCE' ? t('statusMaintenance') : v.status === 'PROFIT' ? t('statusProfit') : t('statusLoss');
    set(`L${r}`, stText, { size: 8, bold: true, color: rowColor, fill: stFill, align: 'center' });
  });

  /* Total row — SUM columns; boxed indigo like the template. */
  const totR = first + data.vehicles.length;
  ws.getRow(totR).height = 19.5;
  const n = data.vehicles.length;
  const rng = (c: string) => `${c}${first}:${c}${totR - 1}`;
  const box = { fill: TOTAL_FILL, box: true, borderColor: B_INDIGO, bold: true } as const;
  set(`B${totR}`, t('totalRow'), { ...box, size: 9, color: INK, align: 'left' });
  set(`C${totR}`, t('totalTrucks', { n }), { ...box, size: 8.5, color: BLACK, align: 'center' });
  set(`D${totR}`, { formula: n ? `SUM(${rng('D')})` : '0', result: s.tripCount } as ExcelJS.CellValue, { ...box, size: 9, fmt: MONEY, color: BLACK, align: 'center' });
  set(`E${totR}`, { formula: n ? `SUM(${rng('E')})` : '0', result: s.totalKm } as ExcelJS.CellValue, { ...box, size: 9, fmt: MONEY, color: BLACK, align: 'right' });
  set(`F${totR}`, { formula: n ? `SUM(${rng('F')})` : '0', result: data.totals.revenue } as ExcelJS.CellValue, { ...box, size: 9, fmt: MONEY, color: GREEN, align: 'right' });
  set(`G${totR}`, { formula: n ? `SUM(${rng('G')})` : '0', result: data.totals.revenue - data.totals.net } as ExcelJS.CellValue, { ...box, size: 9, fmt: MONEY, color: RED, align: 'right' });
  set(`H${totR}`, { formula: n ? `SUM(${rng('H')})` : '0', result: Math.round(totalLiters * 10) / 10 } as ExcelJS.CellValue, { ...box, size: 9, fmt: LITERS, color: BLACK, align: 'center' });
  set(`I${totR}`, kmPerL, { ...box, size: 9, fmt: KM_PER_L_PLAIN, color: GREEN, align: 'center' });
  set(`J${totR}`, { formula: n ? `SUM(${rng('J')})` : '0', result: data.totals.net } as ExcelJS.CellValue, { ...box, size: 9, fmt: MONEY, color: netColor, align: 'right' });
  set(`K${totR}`, { formula: `IFERROR(J${totR}/F${totR},"")`, result: data.totals.revenue !== 0 ? data.totals.net / data.totals.revenue : '' } as ExcelJS.CellValue, { ...box, size: 9, fmt: PERCENT, color: netColor, align: 'center' });
  set(`L${totR}`, DASH, { ...box, size: 9, color: GRAY, bold: false, align: 'center' });

  /* Generation stamp. */
  const noteR = totR + 2;
  ws.mergeCells(`B${noteR}:${LAST}${noteR}`);
  set(`B${noteR}`,
    t('footer', {
      ts: labels.generatedAt.toLocaleString(bcp47, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }),
    { size: 7.5, italic: true, color: MUTE_IT, align: 'left', noBorder: true });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
