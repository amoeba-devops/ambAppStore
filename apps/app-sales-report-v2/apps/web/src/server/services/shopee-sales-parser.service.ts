import 'server-only';
import ExcelJS from 'exceljs';

/**
 * One row from a Shopee Sales export (Order.all.YYYYMMDD_YYYYMMDD.xlsx).
 * Columns mapped by header label — Shopee sometimes reorders columns between
 * export versions, so we resolve column index from header text at parse time.
 */
export interface ShopeeSaleRow {
  orderId: string;
  orderStatus: string;
  productName: string;
  varSku: string;
  originalPrice: number;
  quantity: number;
  quantityReturned: number;
  nmv: number;
  // Per-order columns (duplicated across each SKU line of the same order — see
  // [[per-order-vs-per-row-metrics]]). Must be deduped by orderId before sum.
  shopVoucher: number; // Mã giảm giá của Shop
  shopCombo: number; // Giảm giá từ Combo của Shop
  shopeeVoucher: number; // Mã giảm giá của Shopee (platform-funded)
  shopeeCombo: number; // Giảm giá từ combo Shopee (platform-funded)
  fixedFee: number; // Phí cố định
  serviceFee: number; // Phí Dịch Vụ
  paymentFee: number; // Phí xử lý giao dịch (was "Phí thanh toán" pre-2026-05)
  /**
   * Order placement date as ISO `YYYY-MM-DD` (local-day interpretation from
   * Shopee's "Ngày đặt hàng" column). Empty string when the legacy export
   * file lacks the column — calculator falls back to latest prime cost version.
   */
  orderDate: string;
  /** 1-based row index in the source sheet, for diagnostics. */
  rowIndex: number;
}

// Each field maps to ONE OR MORE accepted header labels. Shopee renames
// columns occasionally (e.g. "Phí thanh toán" → "Phí xử lý giao dịch" mid-2026);
// list new labels first, keep old aliases for backward compat with archived files.
const HEADER_MAP = {
  orderId: ['Mã đơn hàng'],
  orderStatus: ['Trạng Thái Đơn Hàng'],
  productName: ['Tên sản phẩm'],
  varSku: ['SKU phân loại hàng'],
  originalPrice: ['Giá gốc'],
  quantity: ['Số lượng'],
  quantityReturned: ['Số lượng sản phẩm được hoàn trả'],
  nmv: ['Tổng số tiền Người mua thanh toán'],
  shopVoucher: ['Mã giảm giá của Shop'],
  shopCombo: ['Giảm giá từ Combo của Shop'],
  shopeeVoucher: ['Mã giảm giá của Shopee'],
  shopeeCombo: ['Giảm giá từ combo Shopee'],
  fixedFee: ['Phí cố định'],
  serviceFee: ['Phí Dịch Vụ'],
  paymentFee: ['Phí xử lý giao dịch', 'Phí thanh toán'],
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class ShopeeSalesParseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_SHEET'
      | 'MISSING_COLUMN'
      | 'EMPTY_FILE'
      | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'ShopeeSalesParseError';
  }
}

const num = (v: ExcelJS.CellValue): number => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v && typeof v.result === 'number') {
    return v.result;
  }
  const s = String(v).replace(/[, ]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') {
    return v.text.trim();
  }
  return String(v).trim();
};

/**
 * Parse Shopee's "Ngày đặt hàng" cell into ISO `YYYY-MM-DD` (local-day).
 * Shopee may export the column as either a real Excel date (ExcelJS returns
 * a JS `Date`) or a string formatted `YYYY-MM-DD HH:mm` / `DD/MM/YYYY`.
 * Returns empty string if value is missing or unparseable.
 */
const orderDateCell = (v: ExcelJS.CellValue): string => {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(typeof v === 'object' && 'text' in v ? v.text : v).trim();
  if (!s) return '';
  // ISO-like prefix `YYYY-MM-DD …` — strip time
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const pad = (n: string) => n.padStart(2, '0');
    return `${dmy[3]}-${pad(dmy[2]!)}-${pad(dmy[1]!)}`;
  }
  // Last-ditch: let Date parse it
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return '';
};

/**
 * Parse a Shopee Sales `.xlsx` export. Reads the first sheet (or one named
 * "orders"), resolves columns by header label so column-order changes in
 * future exports don't break us.
 */
export async function parseShopeeSales(buffer: ArrayBuffer): Promise<ShopeeSaleRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    throw new ShopeeSalesParseError(
      `Failed to read xlsx: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }

  const sheet = wb.getWorksheet('orders') ?? wb.worksheets[0];
  if (!sheet) throw new ShopeeSalesParseError('No worksheets found', 'NO_SHEET');
  if (sheet.rowCount < 2) throw new ShopeeSalesParseError('No data rows', 'EMPTY_FILE');

  // Resolve header → column-index map. Each field accepts one or more
  // aliases; first match wins. NFC-normalize both sides (some Shopee exports
  // mix NFC + NFD Unicode within the same row).
  const headerRow = sheet.getRow(1);
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];

  for (const [field, aliases] of Object.entries(HEADER_MAP) as Array<
    [FieldName, readonly string[]]
  >) {
    let col = -1;
    const aliasesNfc = aliases.map((a) => a.normalize('NFC'));
    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      if (col >= 0) return;
      const cellLabel = text(cell.value).normalize('NFC');
      if (aliasesNfc.includes(cellLabel)) col = colNum;
    });
    if (col === -1) missing.push(aliases[0]!);
    else colByField[field] = col;
  }
  if (missing.length > 0) {
    throw new ShopeeSalesParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  // Optional "Ngày đặt hàng" column — present in modern Shopee exports, absent
  // in legacy files. -1 → calculator falls back to latest-effective version.
  let orderDateCol = -1;
  const orderDateLabelNfc = 'Ngày đặt hàng'.normalize('NFC');
  headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
    if (text(cell.value).normalize('NFC') === orderDateLabelNfc) orderDateCol = colNum;
  });

  const rows: ShopeeSaleRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const orderId = text(row.getCell(colByField.orderId).value);
    // Skip blank rows — Shopee xlsx pads the sheet with empty rows after the
    // last real order; including them inflates orderCounts (every blank row
    // collapses into a phantom '' order key downstream).
    if (!orderId) continue;
    rows.push({
      rowIndex: r,
      orderId,
      orderStatus: text(row.getCell(colByField.orderStatus).value),
      productName: text(row.getCell(colByField.productName).value),
      varSku: text(row.getCell(colByField.varSku).value),
      originalPrice: num(row.getCell(colByField.originalPrice).value),
      quantity: num(row.getCell(colByField.quantity).value),
      quantityReturned: num(row.getCell(colByField.quantityReturned).value),
      nmv: num(row.getCell(colByField.nmv).value),
      shopVoucher: num(row.getCell(colByField.shopVoucher).value),
      shopCombo: num(row.getCell(colByField.shopCombo).value),
      shopeeVoucher: num(row.getCell(colByField.shopeeVoucher).value),
      shopeeCombo: num(row.getCell(colByField.shopeeCombo).value),
      fixedFee: num(row.getCell(colByField.fixedFee).value),
      serviceFee: num(row.getCell(colByField.serviceFee).value),
      paymentFee: num(row.getCell(colByField.paymentFee).value),
      orderDate: orderDateCol > 0 ? orderDateCell(row.getCell(orderDateCol).value) : '',
    });
  }
  return rows;
}
