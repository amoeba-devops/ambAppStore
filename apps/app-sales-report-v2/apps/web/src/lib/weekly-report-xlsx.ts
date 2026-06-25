'use client';

import ExcelJS from 'exceljs';
import type {
  WeeklyReportData,
  ProductMetric,
  WeeklyChannel,
  OverviewRow,
  BreakdownItem,
} from './weekly-report-mock';

interface ExportOptions {
  /** "Weekly Report" / "Monthly Report" — used as the spreadsheet title row. */
  reportTitle: string;
  /** "W19" / "Apr 2026" */
  currentLabel: string;
  /** "W18" / "Mar 2026" — drawn next to the current label in the title row. */
  prevLabel: string;
  /** Delta column header in tables — "WoW%" / "MoM%". */
  deltaLabel: string;
  /** Channel-specific filename + sheet title prefix. */
  channel: WeeklyChannel;
  channelLabel: string;
  krwRate: number;
  /** Full report data (Overview + Discount + Promo + Traffic + Sales). */
  report: WeeklyReportData;
  /** Per-product breakdown rows. Empty array for Total Platform — caller is
   *  responsible for filtering by channel. */
  products: ProductMetric[];
}

const TITLE_FONT = { name: 'Calibri', size: 13, bold: true } as const;
const SECTION_FONT = { name: 'Calibri', size: 11, bold: true } as const;
const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F4F6' },
};
const HIGHLIGHT_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFECFDF5' },
};

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '_');
}

/** Build the workbook + trigger a browser download. */
export async function downloadReportXlsx(opts: ExportOptions): Promise<void> {
  const wb = buildWorkbook(opts);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const reportTag = opts.reportTitle.toLowerCase().replace(/\s+/g, '-');
  const channelTag = opts.channelLabel.toLowerCase().replace(/\s+/g, '-');
  const today = new Date().toISOString().slice(0, 10);
  const filename = safeFilename(`${reportTag}_${opts.currentLabel}_${channelTag}_${today}.xlsx`);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildWorkbook(opts: ExportOptions): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FIRGI Sales Report';
  wb.created = new Date();

  const main = wb.addWorksheet('Report');
  fillReportSheet(main, opts);

  // Product Breakdown sheet only when the user explicitly drilled into a
  // single channel (Total Platform aggregates per-product data ambiguously).
  if (opts.channel !== 'ALL' && opts.products.length > 0) {
    const products = wb.addWorksheet('Product Breakdown');
    fillProductSheet(products, opts);
  }

  return wb;
}

// ============================================================================
// Sheet 1 — Report
// ============================================================================

function fillReportSheet(sheet: ExcelJS.Worksheet, opts: ExportOptions): void {
  const { reportTitle, currentLabel, prevLabel, deltaLabel, channelLabel, krwRate, report } = opts;

  sheet.columns = [
    { width: 38 }, // metric
    { width: 18 }, // VND
    { width: 14 }, // KRW
    { width: 14 }, // % Net GMV
    { width: 12 }, // delta
  ];

  // ---- Title block -----------------------------------------------------
  const titleCell = sheet.getCell('A1');
  titleCell.value = `${reportTitle} — ${currentLabel}`;
  titleCell.font = { ...TITLE_FONT, size: 14 };
  sheet.mergeCells('A1:E1');

  const subCell = sheet.getCell('A2');
  subCell.value = `${channelLabel} · ${currentLabel} vs ${prevLabel}`;
  subCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };
  sheet.mergeCells('A2:E2');

  const metaCell = sheet.getCell('A3');
  metaCell.value = `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · 1 KRW = ${krwRate.toLocaleString('en-US')} VND`;
  metaCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF9CA3AF' } };
  sheet.mergeCells('A3:E3');

  let row = 5;

  // ---- KPI block -------------------------------------------------------
  row = writeSection(sheet, row, 'KPIs');
  writeKpiRow(sheet, row++, 'Net GMV', report.netGmv, report.netGmvWow, krwRate);
  writeKpiRow(sheet, row++, 'Total CM', report.cm, report.cmWow, krwRate, true);
  writeRatioKpiRow(sheet, row++, 'CM %', report.cmPct, report.cmPctWow, true);
  row++;

  // ---- Overview --------------------------------------------------------
  row = writeSection(sheet, row, 'Overview');
  row = writeOverviewTable(sheet, row, report.overview, krwRate, deltaLabel);
  row++;

  // ---- Breakdown sections ---------------------------------------------
  row = writeBreakdownSection(sheet, row, 'Discount Breakdown', report.discounts, krwRate, deltaLabel);
  row++;
  row = writeBreakdownSection(sheet, row, 'Promotional Breakdown', report.promo, krwRate, deltaLabel);
  row++;
  // Traffic block header changes per channel — caller passes the correct label
  // via deltaLabel context (Traffic and Ads / Traffic).
  const trafficTitle =
    opts.channel === 'TIKTOK' ? 'Traffic' : 'Traffic and Ads';
  row = writeBreakdownSection(sheet, row, trafficTitle, report.traffic, krwRate, deltaLabel);
  row++;
  row = writeBreakdownSection(sheet, row, 'Sales', report.sales, krwRate, deltaLabel);
}

function writeSection(sheet: ExcelJS.Worksheet, row: number, title: string): number {
  const cell = sheet.getCell(row, 1);
  cell.value = title.toUpperCase();
  cell.font = SECTION_FONT;
  return row + 1;
}

function writeKpiRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: number,
  delta: number | null,
  krwRate: number,
  highlight = false,
): void {
  const labelCell = sheet.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { name: 'Calibri', size: 10, bold: true };

  const vndCell = sheet.getCell(row, 2);
  vndCell.value = Math.round(value);
  vndCell.numFmt = '#,##0';
  vndCell.alignment = { horizontal: 'right' };

  const krwCell = sheet.getCell(row, 3);
  krwCell.value = krwRate > 0 ? Math.round(value / krwRate) : '';
  krwCell.numFmt = '#,##0';
  krwCell.alignment = { horizontal: 'right' };
  krwCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };

  // No % Net GMV column on KPI block (column D blank).
  sheet.getCell(row, 4).value = '';

  const deltaCell = sheet.getCell(row, 5);
  if (delta == null) {
    deltaCell.value = '—';
  } else {
    deltaCell.value = delta;
    deltaCell.numFmt = '+0.0%;-0.0%;0.0%';
    deltaCell.font = { name: 'Calibri', size: 10, color: { argb: delta >= 0 ? 'FF10B981' : 'FFEF4444' } };
  }
  deltaCell.alignment = { horizontal: 'right' };

  if (highlight) {
    [labelCell, vndCell, krwCell, deltaCell].forEach((c) => {
      c.fill = HIGHLIGHT_FILL;
    });
  }
}

function writeRatioKpiRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  ratio: number,
  delta: number | null,
  highlight = false,
): void {
  const labelCell = sheet.getCell(row, 1);
  labelCell.value = label;
  labelCell.font = { name: 'Calibri', size: 10, bold: true };

  const ratioCell = sheet.getCell(row, 2);
  ratioCell.value = ratio;
  ratioCell.numFmt = '0.00%';
  ratioCell.alignment = { horizontal: 'right' };

  sheet.getCell(row, 3).value = '';
  sheet.getCell(row, 4).value = '';

  const deltaCell = sheet.getCell(row, 5);
  if (delta == null) {
    deltaCell.value = '—';
  } else {
    deltaCell.value = delta;
    deltaCell.numFmt = '+0.0%;-0.0%;0.0%';
    deltaCell.font = { name: 'Calibri', size: 10, color: { argb: delta >= 0 ? 'FF10B981' : 'FFEF4444' } };
  }
  deltaCell.alignment = { horizontal: 'right' };

  if (highlight) {
    [labelCell, ratioCell, deltaCell].forEach((c) => {
      c.fill = HIGHLIGHT_FILL;
    });
  }
}

function writeOverviewTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  rows: OverviewRow[],
  krwRate: number,
  deltaLabel: string,
): number {
  let row = startRow;
  const headers = ['Metric', 'VND', 'KRW', '% Net GMV', deltaLabel];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right' };
  });
  row++;

  for (const r of rows) {
    if (r.placeholder) {
      const labelCell = sheet.getCell(row, 1);
      labelCell.value = (r.isSubItem ? '   ' : '') + r.metric;
      labelCell.font = { name: 'Calibri', size: 10 };
      for (let c = 2; c <= 5; c++) sheet.getCell(row, c).value = '—';
      row++;
      continue;
    }
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = (r.isSubItem ? '   ' : '') + r.metric;
    labelCell.font = {
      name: 'Calibri',
      size: 10,
      bold: !!(r.isGroupTotal || r.highlight),
    };

    const vndCell = sheet.getCell(row, 2);
    if (r.isRatio) {
      vndCell.value = r.vnd;
      vndCell.numFmt = '0.00%';
    } else {
      vndCell.value = Math.round(r.vnd);
      vndCell.numFmt = '#,##0';
    }
    vndCell.alignment = { horizontal: 'right' };

    const krwCell = sheet.getCell(row, 3);
    if (r.isRatio) {
      krwCell.value = '—';
    } else {
      krwCell.value = krwRate > 0 ? Math.round(r.vnd / krwRate) : '';
      krwCell.numFmt = '#,##0';
    }
    krwCell.alignment = { horizontal: 'right' };
    krwCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };

    const pctCell = sheet.getCell(row, 4);
    if (r.isRatio) {
      pctCell.value = '—';
    } else {
      pctCell.value = r.pctGmv;
      pctCell.numFmt = '0.00%';
    }
    pctCell.alignment = { horizontal: 'right' };

    const deltaCell = sheet.getCell(row, 5);
    if (r.wowPct == null) {
      deltaCell.value = '—';
    } else {
      deltaCell.value = r.wowPct;
      deltaCell.numFmt = '+0.0%;-0.0%;0.0%';
      const positive = r.wowPct >= 0;
      deltaCell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: positive ? 'FF10B981' : 'FFEF4444' },
      };
    }
    deltaCell.alignment = { horizontal: 'right' };

    if (r.highlight) {
      [labelCell, vndCell, krwCell, pctCell, deltaCell].forEach((c) => {
        c.fill = HIGHLIGHT_FILL;
      });
    }
    row++;
  }
  return row;
}

function writeBreakdownSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  items: BreakdownItem[],
  krwRate: number,
  deltaLabel: string,
): number {
  let row = writeSection(sheet, startRow, title);
  if (items.length === 0) return row;

  const hasMoney = items.some((it) => it.vnd != null && it.rawDisplay == null);
  const headers = hasMoney
    ? ['Metric', 'VND', 'KRW', '% Net GMV', deltaLabel]
    : ['Metric', 'Value', '', '% Net GMV', deltaLabel];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right' };
  });
  row++;

  for (const it of items) {
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = it.label;
    labelCell.font = {
      name: 'Calibri',
      size: 10,
      bold: !!it.summary,
      italic: !!it.reference,
      color: it.reference ? { argb: 'FF9CA3AF' } : undefined,
    };

    const isMoney = it.vnd != null && it.rawDisplay == null;
    const vndCell = sheet.getCell(row, 2);
    if (it.rawDisplay != null) {
      // Try to coerce e.g. "12,345" to number so Excel can format; fall back to string.
      const cleaned = it.rawDisplay.replace(/[,\s]/g, '');
      const num = Number(cleaned);
      if (Number.isFinite(num) && cleaned !== '') {
        vndCell.value = num;
        vndCell.numFmt = '#,##0';
      } else {
        vndCell.value = it.rawDisplay;
      }
    } else if (isMoney) {
      vndCell.value = Math.round(it.vnd as number);
      vndCell.numFmt = '#,##0';
    } else if (it.raw != null) {
      vndCell.value = it.raw;
      vndCell.numFmt = '#,##0.00';
    } else {
      vndCell.value = '—';
    }
    vndCell.alignment = { horizontal: 'right' };

    const krwCell = sheet.getCell(row, 3);
    if (isMoney && krwRate > 0) {
      krwCell.value = Math.round((it.vnd as number) / krwRate);
      krwCell.numFmt = '#,##0';
    } else {
      krwCell.value = '—';
    }
    krwCell.alignment = { horizontal: 'right' };
    krwCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } };

    const pctCell = sheet.getCell(row, 4);
    if (it.pctGmv != null && isMoney) {
      pctCell.value = it.pctGmv;
      pctCell.numFmt = '0.00%';
    } else {
      pctCell.value = '—';
    }
    pctCell.alignment = { horizontal: 'right' };

    const deltaCell = sheet.getCell(row, 5);
    if (it.wowPct == null) {
      deltaCell.value = '—';
    } else {
      deltaCell.value = it.wowPct;
      deltaCell.numFmt = '+0.0%;-0.0%;0.0%';
      const positive = it.wowPct >= 0;
      deltaCell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: positive ? 'FF10B981' : 'FFEF4444' },
      };
    }
    deltaCell.alignment = { horizontal: 'right' };

    if (it.summary) {
      [labelCell, vndCell, krwCell, pctCell, deltaCell].forEach((c) => {
        c.fill = HIGHLIGHT_FILL;
      });
    }
    row++;
  }
  return row;
}

// ============================================================================
// Sheet 2 — Product Breakdown
// ============================================================================

const PRODUCT_COLUMNS = [
  { key: 'no', label: 'No', width: 6 },
  { key: 'sku', label: 'SKU', width: 16 },
  { key: 'nameVi', label: 'Product (VI)', width: 32 },
  { key: 'nameEn', label: 'Product (EN)', width: 32 },
  { key: 'platform', label: 'Platform', width: 10 },
  { key: 'pv', label: 'PV', width: 10 },
  { key: 'cvr', label: 'CVR%', width: 8 },
  { key: 'items', label: 'Items', width: 8 },
  { key: 'gmv', label: 'GMV', width: 16 },
  { key: 'netGmv', label: 'Net GMV', width: 16 },
  { key: 'nmv', label: 'NMV', width: 16 },
  { key: 'voucher', label: 'Voucher', width: 14 },
  { key: 'sellerDisc', label: 'Seller Disc', width: 14 },
  { key: 'freeGift', label: 'Free Gift', width: 14 },
  { key: 'adSpend', label: 'AD Spend', width: 14 },
  { key: 'brandAds', label: 'Brand Ads', width: 14 },
  { key: 'offPlatformAds', label: 'Off-Platform Ads', width: 16 },
  { key: 'affComm', label: 'Aff.Comm', width: 14 },
  { key: 'affBook', label: 'Aff.Book', width: 14 },
  { key: 'livestream', label: 'Livestream', width: 14 },
  { key: 'platformFee', label: 'Platform Fee', width: 14 },
  { key: 'primeCost', label: 'Prime Cost', width: 14 },
  { key: 'cm', label: 'CM', width: 14 },
  { key: 'cmPct', label: 'CM%', width: 8 },
] as const;

function fillProductSheet(sheet: ExcelJS.Worksheet, opts: ExportOptions): void {
  const { products, channelLabel, currentLabel, reportTitle } = opts;

  sheet.columns = PRODUCT_COLUMNS.map((c) => ({ width: c.width }));

  // Title row
  const title = sheet.getCell('A1');
  title.value = `${reportTitle} — Product Breakdown · ${currentLabel} (${channelLabel})`;
  title.font = TITLE_FONT;
  sheet.mergeCells(1, 1, 1, PRODUCT_COLUMNS.length);

  // Header row
  const headerRow = 3;
  PRODUCT_COLUMNS.forEach((col, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = col.label;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = {
      horizontal: i <= 4 ? 'left' : 'right',
      vertical: 'middle',
    };
  });
  sheet.views = [{ state: 'frozen', ySplit: headerRow }];

  // TOTAL row
  const sum = (k: keyof ProductMetric) =>
    products.reduce((a, b) => a + (typeof b[k] === 'number' ? (b[k] as number) : 0), 0);
  const sumExGifts = (k: keyof ProductMetric) =>
    products.reduce((a, b) => a + (!b.isGift && typeof b[k] === 'number' ? (b[k] as number) : 0), 0);
  const totals = {
    pv: sum('pv'),
    items: sumExGifts('items'),
    gmv: sum('gmv'),
    netGmv: sum('netGmv'),
    nmv: sum('nmv'),
    voucher: sum('voucher'),
    sellerDisc: sum('sellerDisc'),
    freeGift: sum('freeGift'),
    adSpend: sum('adSpend'),
    brandAds: sum('brandAds'),
    offPlatformAds: sum('offPlatformAds'),
    affComm: sum('affComm'),
    affBook: sum('affBook'),
    livestream: sum('livestream'),
    platformFee: sum('platformFee'),
    primeCost: sum('primeCost'),
    cm: sum('cm'),
  };

  const totalRow = 4;
  const totalsByKey: Record<string, number | string> = {
    no: 'TOTAL',
    sku: '',
    nameVi: '',
    nameEn: '',
    platform: '',
    pv: totals.pv,
    cvr: totals.pv > 0 ? totals.items / totals.pv : '—',
    items: totals.items,
    gmv: totals.gmv,
    netGmv: totals.netGmv,
    nmv: totals.nmv,
    voucher: totals.voucher,
    sellerDisc: totals.sellerDisc,
    freeGift: totals.freeGift,
    adSpend: totals.adSpend,
    brandAds: totals.brandAds,
    offPlatformAds: totals.offPlatformAds,
    affComm: totals.affComm,
    affBook: totals.affBook,
    livestream: totals.livestream,
    platformFee: totals.platformFee,
    primeCost: totals.primeCost,
    cm: totals.cm,
    cmPct: totals.netGmv > 0 ? totals.cm / totals.netGmv : '—',
  };
  PRODUCT_COLUMNS.forEach((col, i) => {
    const cell = sheet.getCell(totalRow, i + 1);
    const v = totalsByKey[col.key];
    cell.value = v;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: i <= 4 ? 'left' : 'right' };
    if (col.key === 'cvr' || col.key === 'cmPct') cell.numFmt = '0.00%';
    else if (typeof v === 'number') cell.numFmt = '#,##0';
  });

  // Data rows
  products.forEach((p, idx) => {
    const row = totalRow + 1 + idx;
    PRODUCT_COLUMNS.forEach((col, i) => {
      const cell = sheet.getCell(row, i + 1);
      let value: string | number | null = null;
      switch (col.key) {
        case 'no':
          value = p.no;
          break;
        case 'sku':
          value = p.sku;
          break;
        case 'nameVi':
          value = p.nameVi;
          break;
        case 'nameEn':
          value = p.nameEn;
          break;
        case 'platform':
          value = p.platform;
          break;
        case 'cvr':
          value = p.isGift || p.isShopWideAd ? '—' : p.cvr;
          break;
        case 'cmPct':
          value = p.isGift || p.isShopWideAd
            ? '—'
            : p.netGmv > 0
              ? p.cm / p.netGmv
              : 0;
          break;
        default: {
          const raw = p[col.key as keyof ProductMetric];
          value = typeof raw === 'number' ? raw : raw == null ? '' : String(raw);
          if (p.isShopWideAd && (col.key === 'pv' || col.key === 'items' || col.key === 'gmv')) value = '—';
          if (p.isGift && (col.key === 'gmv' || col.key === 'netGmv' || col.key === 'nmv')) value = '—';
        }
      }
      cell.value = value;
      cell.alignment = { horizontal: i <= 4 ? 'left' : 'right', vertical: 'middle' };
      if (col.key === 'cvr' || col.key === 'cmPct') cell.numFmt = '0.00%';
      else if (typeof value === 'number') cell.numFmt = '#,##0';

      // Visual cues
      if (p.isGift) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFBEB' }, // pale yellow
        };
      } else if (p.isOthers) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }, // pale grey
        };
        cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
      } else if (p.isShopWideAd) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFF6FF' }, // pale blue
        };
      }
    });
  });
}
