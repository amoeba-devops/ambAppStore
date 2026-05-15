import 'server-only';
import { unzipSync, strFromU8 } from 'fflate';

/**
 * One row from a TikTok Shop Sales (OrderSKUList) xlsx export.
 *
 * ⚠️ TikTok xlsx export uses MALFORMED row XML — each header cell in row 1
 * is its own `<row r="1">` element instead of one row containing multiple
 * cells. ExcelJS reads only one cell. We use a custom regex-based XML parser
 * to handle this. Data row 2 contains COLUMN DESCRIPTIONS (skip); real data
 * starts at row 3.
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

function colLetterToIdx(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function findSheetXml(zip: Record<string, Uint8Array>): string | null {
  // Look for any xl/worksheets/sheet*.xml — TikTok uses sheet2.xml
  for (const name of Object.keys(zip)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      return strFromU8(zip[name]!);
    }
  }
  return null;
}

export async function parseTikTokSales(buffer: ArrayBuffer): Promise<TikTokSaleRow[]> {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(buffer));
  } catch (err) {
    throw new TikTokSalesParseError(
      `Failed to unzip xlsx: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const xml = findSheetXml(zip);
  if (!xml) throw new TikTokSalesParseError('No worksheet XML found', 'NO_SHEET');

  // Custom regex parser — TikTok writes each cell as its own <row r="N"> element,
  // so we extract cells directly and group by row number.
  const rows = new Map<number, Map<number, string | number>>();
  const cellRegex = /<c\s+r="([A-Z]+)(\d+)"([^>]*)>(.*?)<\/c>/gs;
  let m: RegExpExecArray | null;
  while ((m = cellRegex.exec(xml)) !== null) {
    const [, colLetters, rowStr, attrs, inner] = m;
    const colIdx = colLetterToIdx(colLetters!);
    const rowNum = Number(rowStr);
    const typeMatch = attrs!.match(/t="([^"]+)"/);
    const cellType = typeMatch ? typeMatch[1] : null;
    let value: string | number;
    if (cellType === 'inlineStr') {
      const tMatch = inner!.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      value = tMatch ? tMatch[1]! : '';
    } else {
      const vMatch = inner!.match(/<v>([\s\S]*?)<\/v>/);
      if (!vMatch) continue;
      const raw = vMatch[1]!;
      if (cellType === 'str' || cellType === 'b') value = raw;
      else value = Number(raw);
    }
    if (!rows.has(rowNum)) rows.set(rowNum, new Map());
    rows.get(rowNum)!.set(colIdx, value);
  }

  if (rows.size < 3) {
    throw new TikTokSalesParseError('No data rows (need at least header + descriptions + 1 data)', 'EMPTY_FILE');
  }

  // Resolve headers from row 1 (NFC normalize)
  const headerRow = rows.get(1) ?? new Map();
  const colByName = new Map<string, number>();
  for (const [c, v] of headerRow) {
    colByName.set(String(v).trim().normalize('NFC'), c);
  }
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];
  for (const [field, label] of Object.entries(HEADER_MAP) as Array<[FieldName, string]>) {
    const idx = colByName.get(label.normalize('NFC'));
    if (idx == null) missing.push(label);
    else colByField[field] = idx;
  }
  if (missing.length > 0) {
    throw new TikTokSalesParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const num = (v: string | number | undefined): number => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    const n = Number(String(v).replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const text = (v: string | number | undefined): string =>
    v == null ? '' : String(v).trim();

  const out: TikTokSaleRow[] = [];
  // Row 2 contains column DESCRIPTIONS — skip. Data starts row 3.
  const maxRow = Math.max(...rows.keys());
  for (let r = 3; r <= maxRow; r++) {
    const row = rows.get(r);
    if (!row) continue;
    out.push({
      rowIndex: r,
      orderId: text(row.get(colByField.orderId)),
      orderStatus: text(row.get(colByField.orderStatus)),
      orderSubstatus: text(row.get(colByField.orderSubstatus)),
      cancelType: text(row.get(colByField.cancelType)),
      sellerSku: text(row.get(colByField.sellerSku)),
      productName: text(row.get(colByField.productName)),
      variation: text(row.get(colByField.variation)),
      quantity: num(row.get(colByField.quantity)),
      quantityReturn: num(row.get(colByField.quantityReturn)),
      skuOriginalPrice: num(row.get(colByField.skuOriginalPrice)),
      skuSubtotalBeforeDiscount: num(row.get(colByField.skuSubtotalBeforeDiscount)),
      skuPlatformDiscount: num(row.get(colByField.skuPlatformDiscount)),
      skuSellerDiscount: num(row.get(colByField.skuSellerDiscount)),
      skuSubtotalAfterDiscount: num(row.get(colByField.skuSubtotalAfterDiscount)),
      orderAmount: num(row.get(colByField.orderAmount)),
    });
  }
  return out;
}
