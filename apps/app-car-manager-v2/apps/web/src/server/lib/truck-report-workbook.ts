import 'server-only';
import ExcelJS from 'exceljs';
import type { TruckReportExport } from '@/server/queries/truck-report-export.queries';

/**
 * Comprehensive truck report workbook (client "NEW RULE" template) — one file
 * per (month × region) with 3 sheets:
 *   ① Danh sách chuyến đi   (detailed trip log, all NEW RULE columns)
 *   ② Chi phí & Lợi nhuận — theo xe (per-vehicle monthly P&L)
 *   ③ Tổng hợp P&L          (fleet total + glossary of terms)
 *
 * Styling mirrors the template: Montserrat, grey (#EFEFEF) bold wrapped header
 * rows, bold section titles, dd/mm/yyyy dates, thousands-separated money, frozen
 * headers. Uses ExcelJS (SheetJS free can't style). All numbers come from
 * getTruckReportExport → the same core logic as the finance screen.
 */

const FONT = 'Montserrat';
const MONEY = '#,##0';
const GREY = 'FFEFEFEF';
const ACCENT_SOFT = 'FFFCE4D3';
const ACCENT_TXT = 'FF8A3B12';
const TOTAL = 'FFFFF2CC';
const GREEN_BG = 'FFC6EFCE';
const GREEN_TXT = 'FF1E6B37';
const AMBER_BG = 'FFFFF2CC';
const AMBER_TXT = 'FF9C6500';
const GRID = 'FFD9D9D9';
const thin = { style: 'thin' as const, color: { argb: GRID } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

type Align = 'left' | 'center' | 'right';
interface Col {
  h: string;
  w: number;
  key: string;
  fmt?: string;
  align?: Align;
  bold?: boolean;
}

function bannerRows(ws: ExcelJS.Worksheet, ncol: number, title: string, section: string) {
  const last = ws.getColumn(ncol).letter;
  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell('A1');
  t.value = title;
  t.font = { name: FONT, bold: true, size: 14, color: { argb: ACCENT_TXT } };
  t.alignment = { vertical: 'middle', horizontal: 'left' };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_SOFT } };
  ws.getRow(1).height = 26;
  ws.mergeCells(`A2:${last}2`);
  const s = ws.getCell('A2');
  s.value = section;
  s.font = { name: FONT, bold: true, size: 11, color: { argb: 'FF1A1A1A' } };
  s.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(2).height = 20;
}

function headerRow(ws: ExcelJS.Worksheet, rowNum: number, cols: Col[], startCol = 1) {
  const row = ws.getRow(rowNum);
  cols.forEach((c, i) => {
    const cell = row.getCell(startCol + i);
    cell.value = c.h;
    cell.font = { name: FONT, bold: true, size: 10, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
  });
  row.height = 40;
}

function put(
  ws: ExcelJS.Worksheet,
  r: number,
  c: number,
  value: unknown,
  opts: { fmt?: string; align?: Align; bold?: boolean; fill?: string; color?: string } = {},
) {
  const cell = ws.getCell(r, c);
  cell.value = value as ExcelJS.CellValue;
  cell.font = { name: FONT, size: 10, bold: opts.bold, color: { argb: opts.color ?? 'FF000000' } };
  cell.alignment = { vertical: 'middle', horizontal: opts.align ?? 'center', wrapText: false };
  cell.border = BORDER;
  if (opts.fmt) cell.numFmt = opts.fmt;
  if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
  return cell;
}

export async function buildTruckReportWorkbook(
  data: TruckReportExport,
  labels: { monthLabel: string; regionLabel: string; generatedAt: Date },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Amoeba Car Manager';
  /* Stamped into every sheet's banner (below) so whoever opens this file later
   * — independent of the live app UI — can tell exactly which "Lập báo cáo"
   * run produced these numbers (PLAN-20260707 follow-up). */
  const generatedAtStr = labels.generatedAt.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const title = `BÁO CÁO XE TẢI  ·  ${labels.regionLabel}  ·  ${labels.monthLabel}  ·  Lập lúc ${generatedAtStr}`;

  /* ── ① Danh sách chuyến đi ─────────────────────────────────────────────── */
  const TRIP: Col[] = [
    { h: 'STT', w: 5, key: 'stt' },
    { h: 'Ngày', w: 11, key: 'date', fmt: 'dd/mm/yyyy' },
    { h: 'Phương tiện', w: 12, key: 'plate' },
    { h: 'Tài xế', w: 16, key: 'driver', align: 'left' },
    { h: 'Giờ bắt đầu', w: 9, key: 'startTime' },
    { h: 'Giờ kết thúc', w: 9, key: 'endTime' },
    { h: 'Tên khách hàng', w: 18, key: 'customer', align: 'left' },
    { h: 'Bãi xuất phát', w: 15, key: 'depot', align: 'left' },
    { h: 'Lấy hàng / Giao hàng / Điểm khác', w: 20, key: 'pickup', align: 'left' },
    { h: 'Giao hàng', w: 15, key: 'delivery', align: 'left' },
    { h: 'Thêm điểm (Optional)', w: 15, key: 'waypoint', align: 'left' },
    { h: 'Về bãi', w: 13, key: 'back', align: 'left' },
    { h: 'Km đồng hồ bắt đầu', w: 11, key: 'startKm', fmt: MONEY },
    { h: 'Km đồng hồ kết thúc', w: 11, key: 'endKm', fmt: MONEY },
    { h: 'Tổng km đoạn này', w: 10, key: 'km', fmt: MONEY },
    { h: 'Phí cầu đường', w: 12, key: 'toll', fmt: MONEY, align: 'right' },
    { h: 'Chi phí phát sinh khác', w: 12, key: 'extra', fmt: MONEY, align: 'right' },
    { h: 'Ghi chú chi phí phát sinh', w: 18, key: 'extraNote', align: 'left' },
    { h: 'Giá xăng bình quân (đ/L)', w: 13, key: 'avgPrice', fmt: MONEY, align: 'right' },
    { h: 'Lượng nhiên liệu tiêu thụ (lít)', w: 12, key: 'liters', fmt: '#,##0.0', align: 'right' },
    { h: 'Phí nhiên liệu (phí xăng chuyến)', w: 15, key: 'fuelCost', fmt: MONEY, align: 'right' },
    { h: 'Doanh thu chuyến', w: 13, key: 'revenue', fmt: MONEY, align: 'right' },
    { h: 'Lợi nhuận', w: 13, key: 'profit', fmt: MONEY, align: 'right', bold: true },
    { h: 'Trạng thái', w: 10, key: 'status' },
    { h: 'Số vận đơn', w: 14, key: 'bol' },
    { h: 'Số CDF', w: 14, key: 'cdf' },
  ];
  const ws1 = wb.addWorksheet('Danh sách chuyến đi', {
    views: [{ state: 'frozen', ySplit: 3 }],
    properties: { showGridLines: false },
  });
  TRIP.forEach((c, i) => (ws1.getColumn(i + 1).width = c.w));
  bannerRows(ws1, TRIP.length, title, '① DANH SÁCH CHUYẾN ĐI');
  headerRow(ws1, 3, TRIP);
  data.trips.forEach((t, i) => {
    const r = 4 + i;
    const status = t.finalized ? 'Đã lập BC' : 'Tạm tính';
    const vals: Record<string, unknown> = {
      stt: i + 1,
      date: t.date,
      plate: t.plate,
      driver: t.driver ?? '—',
      startTime: t.startTime ?? '—',
      endTime: t.endTime ?? '—',
      customer: t.customer ?? '—',
      depot: t.depot ?? '—',
      pickup: t.pickup ?? '—',
      delivery: t.delivery ?? '—',
      waypoint: t.waypoint ?? '—',
      back: t.back ?? '—',
      startKm: t.startKm ?? '—',
      endKm: t.endKm ?? '—',
      km: t.km,
      toll: t.toll,
      extra: t.extra,
      extraNote: t.extraNote ?? '—',
      avgPrice: t.avgPrice,
      liters: t.liters,
      fuelCost: t.fuelCost,
      revenue: t.revenue,
      profit: t.profit,
      status,
      bol: t.bol ?? '—',
      cdf: t.cdf ?? '—',
    };
    TRIP.forEach((c, ci) => {
      const isStatus = c.key === 'status';
      put(ws1, r, ci + 1, vals[c.key], {
        fmt: c.fmt,
        align: c.align,
        bold: c.bold,
        fill: isStatus ? (t.finalized ? GREEN_BG : AMBER_BG) : undefined,
        color: isStatus ? (t.finalized ? GREEN_TXT : AMBER_TXT) : c.bold ? GREEN_TXT : undefined,
      });
    });
  });

  /* ── ② Chi phí & Lợi nhuận — theo xe ───────────────────────────────────── */
  const VEH: Col[] = [
    { h: 'STT', w: 5, key: 'stt' },
    { h: 'Tháng', w: 9, key: 'month' },
    { h: 'Phương tiện', w: 13, key: 'plate' },
    { h: 'Khấu hao xe', w: 13, key: 'depreciation', fmt: MONEY, align: 'right' },
    { h: 'Tài xế', w: 16, key: 'driver', align: 'left' },
    { h: 'Lương tài xế', w: 13, key: 'salary', fmt: MONEY, align: 'right' },
    { h: 'Doanh thu tháng', w: 14, key: 'revenue', fmt: MONEY, align: 'right' },
    { h: 'Chi phí cố định', w: 13, key: 'fixedOther', fmt: MONEY, align: 'right' },
    { h: 'Phí cầu đường', w: 12, key: 'toll', fmt: MONEY, align: 'right' },
    { h: 'Phí nhiên liệu', w: 13, key: 'fuel', fmt: MONEY, align: 'right' },
    { h: 'Tổng phí phát sinh', w: 14, key: 'extra', fmt: MONEY, align: 'right' },
    { h: 'Lợi nhuận ròng', w: 14, key: 'net', fmt: MONEY, align: 'right', bold: true },
    { h: 'Trạng thái', w: 10, key: 'status' },
  ];
  const ws2 = wb.addWorksheet('Lợi nhuận theo xe', {
    views: [{ state: 'frozen', ySplit: 3 }],
    properties: { showGridLines: false },
  });
  VEH.forEach((c, i) => (ws2.getColumn(i + 1).width = c.w));
  bannerRows(ws2, VEH.length, title, '② CHI PHÍ & LỢI NHUẬN — THEO XE');
  headerRow(ws2, 3, VEH);
  data.vehicles.forEach((v, i) => {
    const r = 4 + i;
    const vals: Record<string, unknown> = {
      stt: i + 1,
      month: labels.monthLabel.replace('Tháng ', ''),
      plate: v.plate,
      depreciation: v.depreciation,
      driver: v.driver ?? '—',
      salary: v.salary,
      revenue: v.revenue,
      fixedOther: v.fixedOther,
      toll: v.toll,
      fuel: v.fuel,
      extra: v.extra,
      net: v.net,
      status: data.closed ? 'Đã lập BC' : 'Tạm tính',
    };
    VEH.forEach((c, ci) => {
      const isStatus = c.key === 'status';
      const isNet = c.key === 'net';
      put(ws2, r, ci + 1, vals[c.key], {
        fmt: c.fmt,
        align: c.align,
        bold: c.bold,
        fill: isStatus ? (data.closed ? GREEN_BG : AMBER_BG) : undefined,
        color: isStatus
          ? data.closed
            ? GREEN_TXT
            : AMBER_TXT
          : isNet
            ? v.net >= 0
              ? GREEN_TXT
              : 'FFC0392B'
            : undefined,
      });
    });
  });
  /* Total row — sum the per-vehicle rows so each column totals its own metric
   * (matches the per-vehicle breakdown exactly). */
  const vt = data.vehicles.reduce(
    (a, v) => ({
      dep: a.dep + v.depreciation,
      sal: a.sal + v.salary,
      rev: a.rev + v.revenue,
      fix: a.fix + v.fixedOther,
      toll: a.toll + v.toll,
      fuel: a.fuel + v.fuel,
      extra: a.extra + v.extra,
      net: a.net + v.net,
    }),
    { dep: 0, sal: 0, rev: 0, fix: 0, toll: 0, fuel: 0, extra: 0, net: 0 },
  );
  const totR = 4 + data.vehicles.length;
  VEH.forEach((_, ci) => put(ws2, totR, ci + 1, null, { fill: TOTAL }));
  put(ws2, totR, 1, 'TỔNG', { bold: true, fill: TOTAL });
  put(ws2, totR, 3, 'Toàn khu vực', { bold: true, fill: TOTAL, align: 'left' });
  const totCells: [number, number][] = [
    [4, vt.dep], [6, vt.sal], [7, vt.rev], [8, vt.fix],
    [9, vt.toll], [10, vt.fuel], [11, vt.extra], [12, vt.net],
  ];
  for (const [col, val] of totCells) {
    put(ws2, totR, col, val, {
      fmt: MONEY, align: 'right', bold: true, fill: TOTAL,
      color: col === 12 ? GREEN_TXT : undefined,
    });
  }

  /* ── ③ Tổng hợp P&L + glossary ─────────────────────────────────────────── */
  const SUM: Col[] = [
    { h: 'Lương tài xế', w: 15, key: 'salary', fmt: MONEY, align: 'right' },
    { h: 'Doanh thu tháng', w: 16, key: 'revenue', fmt: MONEY, align: 'right' },
    { h: 'Chi phí cố định', w: 15, key: 'fixedOther', fmt: MONEY, align: 'right' },
    { h: 'Phí cầu đường', w: 14, key: 'toll', fmt: MONEY, align: 'right' },
    { h: 'Phí nhiên liệu', w: 14, key: 'fuel', fmt: MONEY, align: 'right' },
    { h: 'Tổng phí phát sinh', w: 15, key: 'extra', fmt: MONEY, align: 'right' },
    { h: 'Lợi nhuận ròng', w: 15, key: 'net', fmt: MONEY, align: 'right', bold: true },
  ];
  const ws3 = wb.addWorksheet('Tổng hợp P&L', { properties: { showGridLines: false } });
  ws3.getColumn(1).width = 3;
  SUM.forEach((c, i) => (ws3.getColumn(i + 2).width = c.w));
  bannerRows(ws3, SUM.length + 1, title, '③ TỔNG HỢP CHI PHÍ & LỢI NHUẬN');
  headerRow(ws3, 4, SUM, 2);
  const sumVals: Record<string, number> = {
    salary: data.totals.salary,
    revenue: data.totals.revenue,
    fixedOther: data.totals.fixedOther,
    toll: data.totals.toll,
    fuel: data.totals.fuel,
    extra: data.totals.extra,
    net: data.totals.net,
  };
  SUM.forEach((c, ci) =>
    put(ws3, 5, ci + 2, sumVals[c.key], {
      fmt: c.fmt,
      align: 'right',
      bold: c.bold,
      fill: c.key === 'net' ? TOTAL : undefined,
      color: c.key === 'net' ? GREEN_TXT : undefined,
    }),
  );

  /* Fuel reconciliation summary line */
  const fr = 7;
  ws3.mergeCells(`B${fr}:H${fr}`);
  const frCell = ws3.getCell(`B${fr}`);
  frCell.value = `Đối soát nhiên liệu tháng: giá xăng bình quân ${data.fuel.avgPrice.toLocaleString('vi-VN')} đ/L · tiêu hao ${data.fuel.consumption.toFixed(3)} L/km · ${data.fuel.invoiceCount} hóa đơn`;
  frCell.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF444444' } };

  /* Generation timestamp — the exact "Lập báo cáo" moment these numbers were
   * frozen at (no lock model means numbers can drift after this). */
  const gtr = 8;
  ws3.mergeCells(`B${gtr}:H${gtr}`);
  const gtCell = ws3.getCell(`B${gtr}`);
  gtCell.value = `Số liệu chính thức tính lúc ${generatedAtStr} — dữ liệu thay đổi sau thời điểm này chỉ cập nhật khi lập lại báo cáo.`;
  gtCell.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF444444' } };

  /* Glossary — "Định nghĩa thuật ngữ" so the terms are unambiguous. */
  const gloss: [string, string][] = [
    ['Doanh thu', 'Doanh thu chuyến nhập khi tạo chuyến đi; Doanh thu tháng = tổng các chuyến.'],
    ['Giá xăng bình quân tháng', 'Trung bình cộng đơn giá các hóa đơn nhiên liệu trong tháng (đ/L).'],
    ['Lượng tiêu hao / km', 'Tổng lít xăng đã đổ trong tháng ÷ tổng km đã đi trong tháng.'],
    ['Phí nhiên liệu (phí xăng chuyến)', 'Tiêu hao/km × km chuyến × giá xăng bình quân tháng (tính lại mỗi lần lập báo cáo).'],
    ['Phí cầu đường / phát sinh', 'Nhập khi hoàn thành chuyến; phát sinh gồm vá vỏ, rửa xe, phí bãi…'],
    ['Lợi nhuận (chuyến)', 'Doanh thu − Phí nhiên liệu − Phí cầu đường − Chi phí phát sinh (trước chi phí cố định tháng).'],
    ['Khấu hao xe', 'Chi phí khấu hao cố định theo tháng của xe.'],
    ['Lương tài xế', 'Lương cố định theo tháng.'],
    ['Chi phí cố định', 'Chi phí cố định khác theo tháng, nếu có (KHÔNG gồm khấu hao & lương — tách riêng để không trùng).'],
    ['Lợi nhuận ròng (tháng)', 'Doanh thu − Phí nhiên liệu − Phí cầu đường − Tổng phí phát sinh − Lương tài xế − Khấu hao − Chi phí cố định.'],
    ['Trạng thái', '“Đã lập BC” = số liệu chính thức theo lần lập báo cáo gần nhất; “Tạm tính” = chưa đủ dữ liệu phân bổ (hóa đơn xăng / km).'],
    ['Số vận đơn (BOL) / Số CDF', 'BOL = Bill of Lading (vận đơn); CDF = tờ khai hải quan — nhập khi tạo chuyến.'],
  ];
  let gr = 9;
  ws3.mergeCells(`B${gr}:H${gr}`);
  const gh = ws3.getCell(`B${gr}`);
  gh.value = 'ĐỊNH NGHĨA THUẬT NGỮ';
  gh.font = { name: FONT, bold: true, size: 11, color: { argb: 'FF1A1A1A' } };
  gr += 1;
  for (const [term, def] of gloss) {
    const tc = ws3.getCell(`B${gr}`);
    tc.value = term;
    tc.font = { name: FONT, bold: true, size: 9, color: { argb: 'FF000000' } };
    tc.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    ws3.mergeCells(`C${gr}:H${gr}`);
    const dc = ws3.getCell(`C${gr}`);
    dc.value = def;
    dc.font = { name: FONT, size: 9, color: { argb: 'FF444444' } };
    dc.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    ws3.getRow(gr).height = 26;
    gr += 1;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
