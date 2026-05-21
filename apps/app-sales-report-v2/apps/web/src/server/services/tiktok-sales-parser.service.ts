import 'server-only';
import {
  cellNumber,
  cellText,
  isXlsx,
  readXlsxGrid,
  resolveHeaderColumns,
  XlsxParseError,
} from './xlsx-grid.util';

/**
 * One row from a TikTok Shop Sales (OrderSKUList) xlsx export.
 *
 * TikTok historically used MALFORMED row XML (each header cell its own
 * `<row r="1">`) with row 2 = column descriptions, data from row 3. New
 * exports use standard xlsx with shared strings, row 2 = data directly.
 * We detect which format by checking whether row 2's Quantity cell parses
 * as a number (data) or remains text (description).
 */
export interface TikTokSaleRow {
  orderId: string;
  orderStatus: string;
  orderSubstatus: string;
  cancelType: string;
  sellerSku: string;
  productName: string;
  variation: string;
  quantity: number;
  quantityReturn: number;
  skuOriginalPrice: number;
  skuSubtotalBeforeDiscount: number;
  skuPlatformDiscount: number;
  skuSellerDiscount: number;
  skuSubtotalAfterDiscount: number;
  orderAmount: number;
  /**
   * Order placement date as ISO `YYYY-MM-DD` (local-day interpretation from
   * TikTok's "Created Time" column). Empty when the legacy export file lacks
   * the column — calculator falls back to latest prime cost version.
   */
  orderDate: string;
  /** 1-based row index in source sheet, for diagnostics. */
  rowIndex: number;
}

const HEADER_MAP = {
  orderId: 'Order ID',
  orderStatus: 'Order Status',
  orderSubstatus: 'Order Substatus',
  cancelType: 'Cancelation/Return Type',
  sellerSku: 'Seller SKU',
  productName: 'Product Name',
  variation: 'Variation',
  quantity: 'Quantity',
  quantityReturn: 'Sku Quantity of return',
  skuOriginalPrice: 'SKU Unit Original Price',
  skuSubtotalBeforeDiscount: 'SKU Subtotal Before Discount',
  skuPlatformDiscount: 'SKU Platform Discount',
  skuSellerDiscount: 'SKU Seller Discount',
  skuSubtotalAfterDiscount: 'SKU Subtotal After Discount',
  orderAmount: 'Order Amount',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class TikTokSalesParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_SHEET' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'TikTokSalesParseError';
  }
}

/**
 * Parse TikTok's "Created Time" cell → ISO `YYYY-MM-DD` (local-day).
 * TikTok exports dates as strings (typically `YYYY-MM-DD HH:mm:ss`). Excel
 * serial numbers also handled defensively. Empty / unparseable → empty string.
 */
function toIsoDate(v: string | number | undefined): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    // Excel serial: days since 1899-12-30 (Excel's epoch). Convert to JS Date.
    const ms = (v - 25569) * 86400 * 1000; // 25569 = days from 1970-01-01 to Excel epoch
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const pad = (n: string) => n.padStart(2, '0');
    return `${dmy[3]}-${pad(dmy[2]!)}-${pad(dmy[1]!)}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return '';
}

export async function parseTikTokSales(buffer: ArrayBuffer): Promise<TikTokSaleRow[]> {
  const bytes = new Uint8Array(buffer);
  if (!isXlsx(bytes)) {
    const head = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, 40))
      .replace(/\r?\n/g, ' ')
      .slice(0, 40);
    throw new TikTokSalesParseError(
      `Not an xlsx file — expected TikTok export (.xlsx). First bytes: "${head}". Re-export from TikTok Seller Center and upload again.`,
      'READ_FAILED',
    );
  }
  let grid: Map<number, Map<number, string | number>>;
  try {
    grid = readXlsxGrid(bytes);
  } catch (err) {
    if (err instanceof XlsxParseError) {
      throw new TikTokSalesParseError(err.message, err.code === 'NO_SHEET' ? 'NO_SHEET' : 'READ_FAILED');
    }
    throw err;
  }

  if (grid.size < 2) {
    throw new TikTokSalesParseError('No data rows', 'EMPTY_FILE');
  }

  const headerRow = grid.get(1);
  if (!headerRow) {
    throw new TikTokSalesParseError('Row 1 missing — cannot resolve headers', 'NO_SHEET');
  }
  const { colByField, missing } = resolveHeaderColumns(headerRow, HEADER_MAP);
  if (missing.length > 0) {
    throw new TikTokSalesParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  // Optional "Created Time" column — present in modern TikTok exports, absent
  // in legacy files. -1 → calculator falls back to latest-effective version.
  let orderDateCol = -1;
  const createdTimeNfc = 'Created Time'.normalize('NFC');
  for (const [c, v] of headerRow) {
    if (typeof v === 'string' && v.trim().normalize('NFC') === createdTimeNfc) {
      orderDateCol = c;
      break;
    }
  }

  // Detect format: OLD TikTok export had a column-description row 2 (text in
  // numeric columns), data started row 3. NEW export goes straight to data on
  // row 2. Heuristic: if row 2's Quantity is parseable as a number, treat
  // row 2 as data; otherwise skip it.
  let dataStart = 2;
  const row2 = grid.get(2);
  if (row2) {
    const r2Qty = row2.get(colByField.quantity);
    const isNumericQty =
      typeof r2Qty === 'number' ||
      (typeof r2Qty === 'string' && /^\s*-?\d/.test(r2Qty));
    if (!isNumericQty) dataStart = 3;
  }

  const out: TikTokSaleRow[] = [];
  const maxRow = Math.max(...grid.keys());
  for (let r = dataStart; r <= maxRow; r++) {
    const row = grid.get(r);
    if (!row) continue;
    const orderId = cellText(row.get(colByField.orderId));
    if (!orderId) continue; // skip blank / footer rows
    out.push({
      rowIndex: r,
      orderId,
      orderStatus: cellText(row.get(colByField.orderStatus)),
      orderSubstatus: cellText(row.get(colByField.orderSubstatus)),
      cancelType: cellText(row.get(colByField.cancelType)),
      sellerSku: cellText(row.get(colByField.sellerSku)),
      productName: cellText(row.get(colByField.productName)),
      variation: cellText(row.get(colByField.variation)),
      quantity: cellNumber(row.get(colByField.quantity)),
      quantityReturn: cellNumber(row.get(colByField.quantityReturn)),
      skuOriginalPrice: cellNumber(row.get(colByField.skuOriginalPrice)),
      skuSubtotalBeforeDiscount: cellNumber(row.get(colByField.skuSubtotalBeforeDiscount)),
      skuPlatformDiscount: cellNumber(row.get(colByField.skuPlatformDiscount)),
      skuSellerDiscount: cellNumber(row.get(colByField.skuSellerDiscount)),
      skuSubtotalAfterDiscount: cellNumber(row.get(colByField.skuSubtotalAfterDiscount)),
      orderAmount: cellNumber(row.get(colByField.orderAmount)),
      orderDate: orderDateCol > 0 ? toIsoDate(row.get(orderDateCol)) : '',
    });
  }
  return out;
}
