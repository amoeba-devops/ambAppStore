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
  fixedFee: number; // Phí cố định
  serviceFee: number; // Phí Dịch Vụ
  paymentFee: number; // Phí thanh toán
  /** 1-based row index in the source sheet, for diagnostics. */
  rowIndex: number;
}

const HEADER_MAP = {
  orderId: 'Mã đơn hàng',
  orderStatus: 'Trạng Thái Đơn Hàng',
  productName: 'Tên sản phẩm',
  varSku: 'SKU phân loại hàng',
  originalPrice: 'Giá gốc',
  quantity: 'Số lượng',
  quantityReturned: 'Số lượng sản phẩm được hoàn trả',
  nmv: 'Tổng số tiền Người mua thanh toán',
  shopVoucher: 'Mã giảm giá của Shop',
  shopCombo: 'Giảm giá từ Combo của Shop',
  fixedFee: 'Phí cố định',
  serviceFee: 'Phí Dịch Vụ',
  paymentFee: 'Phí thanh toán',
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

  // Resolve header → column-index map (NFC-normalize both sides — some
  // Shopee exports mix NFC + NFD Unicode forms within the same row).
  const headerRow = sheet.getRow(1);
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];

  for (const [field, headerLabel] of Object.entries(HEADER_MAP) as Array<[FieldName, string]>) {
    const labelNfc = headerLabel.normalize('NFC');
    let col = -1;
    headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
      if (text(cell.value).normalize('NFC') === labelNfc) col = colNum;
    });
    if (col === -1) missing.push(headerLabel);
    else colByField[field] = col;
  }
  if (missing.length > 0) {
    throw new ShopeeSalesParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeSaleRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    rows.push({
      rowIndex: r,
      orderId: text(row.getCell(colByField.orderId).value),
      orderStatus: text(row.getCell(colByField.orderStatus).value),
      productName: text(row.getCell(colByField.productName).value),
      varSku: text(row.getCell(colByField.varSku).value),
      originalPrice: num(row.getCell(colByField.originalPrice).value),
      quantity: num(row.getCell(colByField.quantity).value),
      quantityReturned: num(row.getCell(colByField.quantityReturned).value),
      nmv: num(row.getCell(colByField.nmv).value),
      shopVoucher: num(row.getCell(colByField.shopVoucher).value),
      shopCombo: num(row.getCell(colByField.shopCombo).value),
      fixedFee: num(row.getCell(colByField.fixedFee).value),
      serviceFee: num(row.getCell(colByField.serviceFee).value),
      paymentFee: num(row.getCell(colByField.paymentFee).value),
    });
  }
  return rows;
}
