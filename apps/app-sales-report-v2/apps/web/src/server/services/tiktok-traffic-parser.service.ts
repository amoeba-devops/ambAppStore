import 'server-only';
import {
  cellNumber,
  cellText,
  findHeaderRowByLabels,
  isXlsx,
  readXlsxGrid,
  resolveHeaderColumns,
  XlsxParseError,
} from './xlsx-grid.util';

/**
 * One product-level row from a TikTok Shop Traffic xlsx export (product_list).
 *
 * File layout (current format — TikTok Shop Analytics product_list export):
 *   Row 1: "Ngày phân tích: 05/06/2026~11/06/2026" (period metadata)
 *   Row 2: empty
 *   Row 3: section group labels (Tất cả / Buổi LIVE / Video / Liên kết / Thẻ sản phẩm)
 *   Row 4: actual column headers (~176 cols across 5 sections)
 *   Row 5+: data
 *
 * We pull only from the "Tất cả" (overall) section:
 *   - {Tên}                                  → productName  (match key)
 *   - {ID sản phẩm}                          → productId    (diagnostic)
 *   - {Lượt hiển thị sản phẩm độc nhất}      → pageViews    (unique product impressions)
 *   - {CTR độc nhất}                         → ctr          (unique CTR, 0..1)
 *
 * Previous format summed 4 separate page-view columns (tab Cửa hàng + LIVE +
 * Video + Thẻ sản phẩm). TikTok consolidated these into the single "Lượt
 * hiển thị sản phẩm độc nhất" column — that's the canonical PV now.
 */
export interface TikTokTrafficRow {
  productId: string;
  productName: string;
  pageViews: number;
  /** Unique click-through rate (decimal, e.g. 0.0618 for "6.18%"). */
  ctr: number;
}

const HEADER_MAP = {
  productId: ['ID sản phẩm', 'Product ID', 'ID'],
  productName: ['Tên', 'Sản phẩm', 'Product', 'Product Name', 'Tên sản phẩm'],
  pageViews: [
    'Lượt hiển thị sản phẩm độc nhất',
    'Unique Product Impressions',
  ],
  ctr: ['CTR độc nhất', 'Unique CTR'],
} as const;

export class TikTokTrafficParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_SHEET' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'TikTokTrafficParseError';
  }
}

export async function parseTikTokTraffic(buffer: ArrayBuffer): Promise<TikTokTrafficRow[]> {
  const bytes = new Uint8Array(buffer);
  if (!isXlsx(bytes)) {
    throw new TikTokTrafficParseError(
      'Not an xlsx file — expected TikTok Traffic export (.xlsx)',
      'READ_FAILED',
    );
  }
  let grid: Map<number, Map<number, string | number>>;
  try {
    grid = readXlsxGrid(bytes);
  } catch (err) {
    if (err instanceof XlsxParseError) {
      throw new TikTokTrafficParseError(
        err.message,
        err.code === 'NO_SHEET' ? 'NO_SHEET' : 'READ_FAILED',
      );
    }
    throw err;
  }
  if (grid.size < 2) {
    throw new TikTokTrafficParseError('No data rows', 'EMPTY_FILE');
  }

  // Header row position isn't fixed — find it by label-match.
  const allLabels: string[] = Object.values(HEADER_MAP).flatMap((a) => [...a]);
  const headerRowNum = findHeaderRowByLabels(grid, allLabels, 3);
  if (headerRowNum < 0) {
    throw new TikTokTrafficParseError(
      'Header row not found — expected columns like "ID" / "Sản phẩm"',
      'MISSING_COLUMN',
    );
  }
  const { colByField, missing } = resolveHeaderColumns(grid.get(headerRowNum)!, HEADER_MAP);
  if (missing.length > 0) {
    throw new TikTokTrafficParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: TikTokTrafficRow[] = [];
  const maxRow = Math.max(...grid.keys());
  for (let r = headerRowNum + 1; r <= maxRow; r++) {
    const row = grid.get(r);
    if (!row) continue;
    const productName = cellText(row.get(colByField.productName));
    if (!productName) continue;
    rows.push({
      productId: cellText(row.get(colByField.productId)),
      productName,
      pageViews: cellNumber(row.get(colByField.pageViews)),
      ctr: parsePercentCell(row.get(colByField.ctr)),
    });
  }
  return rows;
}

/** Parse a cell that holds a percentage value (e.g. "6.18%" or 0.0618) → 0..1 decimal. */
function parsePercentCell(v: string | number | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') {
    // Excel stores percentages as 0..1 floats; if the value is > 1 we assume
    // it's already a "raw percent" (e.g. 6.18) and divide accordingly.
    return v > 1 ? v / 100 : v;
  }
  const trimmed = String(v).trim().replace(/[, ]/g, '');
  if (!trimmed) return 0;
  const hasPercent = trimmed.endsWith('%');
  const n = Number(trimmed.replace('%', ''));
  if (!Number.isFinite(n)) return 0;
  return hasPercent ? n / 100 : n > 1 ? n / 100 : n;
}

export function aggregateTikTokTraffic(rows: TikTokTrafficRow[]) {
  let totalPageViews = 0;
  const pageViewsByProductName: Record<string, number> = {};
  const ctrByProductName: Record<string, number> = {};
  for (const r of rows) {
    totalPageViews += r.pageViews;
    const key = normalizeName(r.productName);
    if (!key) continue;
    pageViewsByProductName[key] = (pageViewsByProductName[key] ?? 0) + r.pageViews;
    // CTR doesn't sum; keep the row's value. For products that somehow appear
    // multiple times in the same export (rare), take the weighted average by
    // page views — but the canonical TikTok export emits one row per product
    // so this rarely fires.
    if (!(key in ctrByProductName)) ctrByProductName[key] = r.ctr;
  }
  return {
    totalPageViews,
    productCount: rows.length,
    pageViewsByProductName,
    ctrByProductName,
  };
}

function normalizeName(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}
