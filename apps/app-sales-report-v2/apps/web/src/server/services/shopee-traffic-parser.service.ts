import 'server-only';
import ExcelJS from 'exceljs';

/**
 * One product-level row from Shopee Traffic xlsx (`parentskudetail` export).
 * The file has multiple sheets; we read the main one "Sản Phẩm Hiệu Quả Tốt".
 * Traffic metrics (page views, visitors) live at PRODUCT level only —
 * variation rows have order data but `-` in traffic columns.
 */
export interface ShopeeTrafficRow {
  productId: string;
  productName: string;
  pageViews: number;
  productViews: number;
  visitors: number;
}

const MAIN_SHEET = 'Sản Phẩm Hiệu Quả Tốt';

const HEADER_MAP = {
  productId: 'Mã sản phẩm',
  productName: 'Sản phẩm',
  variationSku: 'SKU phân loại',
  pageViews: 'Lượt xem trang sản phẩm',
  productViews: 'Lượt xem sản phẩm',
  visitors: 'Lượt truy cập sản phẩm',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class ShopeeTrafficParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_SHEET' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'ShopeeTrafficParseError';
  }
}

/**
 * Vietnamese-locale number: `190.464.212` = 190,464,212 (dots are thousand seps).
 * Page-views etc. are integers, so strip dots and decimal-comma tail.
 */
const num = (v: ExcelJS.CellValue): number => {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v && typeof v.result === 'number') return v.result;
  const s = String(v).replace(/[.\s]/g, '').replace(/[,].*/, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') return v.text.trim();
  return String(v).trim();
};

export async function parseShopeeTraffic(buffer: ArrayBuffer): Promise<ShopeeTrafficRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    throw new ShopeeTrafficParseError(
      `Failed to read xlsx: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const sheet = wb.getWorksheet(MAIN_SHEET) ?? wb.worksheets[0];
  if (!sheet) throw new ShopeeTrafficParseError('No worksheets found', 'NO_SHEET');
  if (sheet.rowCount < 2) throw new ShopeeTrafficParseError('No data rows', 'EMPTY_FILE');

  // Resolve columns by header name with NFC normalization
  const headerRow = sheet.getRow(1);
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];
  for (const [field, label] of Object.entries(HEADER_MAP) as Array<[FieldName, string]>) {
    const labelNfc = label.normalize('NFC');
    let col = -1;
    headerRow.eachCell({ includeEmpty: false }, (cell, c) => {
      if (text(cell.value).normalize('NFC') === labelNfc) col = c;
    });
    if (col === -1) missing.push(label);
    else colByField[field] = col;
  }
  if (missing.length > 0) {
    throw new ShopeeTrafficParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeTrafficRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const variationSku = text(row.getCell(colByField.variationSku).value);
    // Skip variation rows — traffic metrics live only at product-level
    if (variationSku !== '-' && variationSku !== '') continue;

    rows.push({
      productId: text(row.getCell(colByField.productId).value),
      productName: text(row.getCell(colByField.productName).value),
      pageViews: num(row.getCell(colByField.pageViews).value),
      productViews: num(row.getCell(colByField.productViews).value),
      visitors: num(row.getCell(colByField.visitors).value),
    });
  }
  return rows;
}

export function aggregateTraffic(rows: ShopeeTrafficRow[]) {
  let totalPageViews = 0;
  let totalProductViews = 0;
  let totalVisitors = 0;
  for (const r of rows) {
    totalPageViews += r.pageViews;
    totalProductViews += r.productViews;
    totalVisitors += r.visitors;
  }
  return {
    totalPageViews,
    totalProductViews,
    totalVisitors,
    productCount: rows.length,
  };
}
