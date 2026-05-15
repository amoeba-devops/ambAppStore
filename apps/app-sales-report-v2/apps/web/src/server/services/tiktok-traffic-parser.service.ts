import 'server-only';
import ExcelJS from 'exceljs';

/**
 * One product-level row from a TikTok Shop Traffic xlsx export (product_list).
 *
 * File structure:
 *   Row 1: period range string (e.g. "2026-05-01 ~ 2026-05-07")
 *   Row 2: empty
 *   Row 3: column headers (Vietnamese)
 *   Row 4+: data, 1 row per product
 *
 * Per cm-calculator skill §4:
 *   TikTok page_view per product = SUM of 4 sources (Tab Cửa hàng + LIVE + Video + Thẻ sản phẩm)
 */
export interface TikTokTrafficRow {
  productId: string;
  productName: string;
  pageViews: number;
  /** Breakdown by source — useful for diagnostics. */
  pageViewsShopTab: number;
  pageViewsLive: number;
  pageViewsVideo: number;
  pageViewsProductCard: number;
}

const HEADER_MAP = {
  productId: 'ID',
  productName: 'Sản phẩm',
  pvShopTab: 'Lượt xem trang từ tab Cửa hàng',
  pvLive: 'Lượt xem trang từ LIVE',
  pvVideo: 'Lượt xem trang từ video',
  pvProductCard: 'Lượt xem trang từ thẻ sản phẩm',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class TikTokTrafficParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_SHEET' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'TikTokTrafficParseError';
  }
}

const num = (v: ExcelJS.CellValue): number => {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v && typeof v.result === 'number') return v.result;
  const s = String(v).replace(/[, ]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') return v.text.trim();
  return String(v).trim();
};

export async function parseTikTokTraffic(buffer: ArrayBuffer): Promise<TikTokTrafficRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    throw new TikTokTrafficParseError(
      `Failed to read xlsx: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new TikTokTrafficParseError('No worksheets found', 'NO_SHEET');
  if (sheet.rowCount < 4) throw new TikTokTrafficParseError('No data rows', 'EMPTY_FILE');

  // Header row is row 3 (row 1 is period range, row 2 is blank)
  const headerRow = sheet.getRow(3);
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
    throw new TikTokTrafficParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: TikTokTrafficRow[] = [];
  for (let r = 4; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const productId = text(row.getCell(colByField.productId).value);
    if (!productId) continue;
    const s = num(row.getCell(colByField.pvShopTab).value);
    const l = num(row.getCell(colByField.pvLive).value);
    const v = num(row.getCell(colByField.pvVideo).value);
    const c = num(row.getCell(colByField.pvProductCard).value);
    rows.push({
      productId,
      productName: text(row.getCell(colByField.productName).value),
      pageViewsShopTab: s,
      pageViewsLive: l,
      pageViewsVideo: v,
      pageViewsProductCard: c,
      pageViews: s + l + v + c,
    });
  }
  return rows;
}

export function aggregateTikTokTraffic(rows: TikTokTrafficRow[]) {
  let totalPageViews = 0;
  let pvShopTab = 0, pvLive = 0, pvVideo = 0, pvProductCard = 0;
  for (const r of rows) {
    totalPageViews += r.pageViews;
    pvShopTab += r.pageViewsShopTab;
    pvLive += r.pageViewsLive;
    pvVideo += r.pageViewsVideo;
    pvProductCard += r.pageViewsProductCard;
  }
  return {
    totalPageViews,
    pvShopTab,
    pvLive,
    pvVideo,
    pvProductCard,
    productCount: rows.length,
  };
}
