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
 * File layout has historically been: row 1 period range, row 2 blank, row 3
 * headers, row 4+ data. New exports may move the header row, so we search
 * for it by label-match rather than pinning row 3.
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

// vi default + en aliases as defensive coverage in case Seller Center flips
// the export locale.
const HEADER_MAP = {
  productId: ['ID', 'Product ID', 'ID sản phẩm'],
  productName: ['Sản phẩm', 'Product', 'Product Name', 'Tên sản phẩm'],
  pvShopTab: ['Lượt xem trang từ tab Cửa hàng', 'Page views from Shop Tab'],
  pvLive: ['Lượt xem trang từ LIVE', 'Page views from LIVE'],
  pvVideo: ['Lượt xem trang từ video', 'Page views from Video'],
  pvProductCard: ['Lượt xem trang từ thẻ sản phẩm', 'Page views from Product Card'],
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
    const productId = cellText(row.get(colByField.productId));
    if (!productId) continue;
    const s = cellNumber(row.get(colByField.pvShopTab));
    const l = cellNumber(row.get(colByField.pvLive));
    const v = cellNumber(row.get(colByField.pvVideo));
    const c = cellNumber(row.get(colByField.pvProductCard));
    rows.push({
      productId,
      productName: cellText(row.get(colByField.productName)),
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
