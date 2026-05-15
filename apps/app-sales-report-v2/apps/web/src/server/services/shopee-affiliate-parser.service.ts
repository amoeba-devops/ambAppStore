import 'server-only';

/**
 * One row from Shopee Affiliate (Seller Conversion Report) CSV export.
 * One row per product-line per affiliate conversion (orders can span multiple rows
 * for multi-product orders + multi-affiliate attribution).
 *
 * Total Affiliate Commission = SUM(chiPhi) across all rows. Includes both pending
 * and completed orders + Shopee processing fee on top of pure commission.
 */
export interface ShopeeAffiliateRow {
  orderId: string;
  status: string;
  productId: string;
  productName: string;
  quantity: number;
  /** Commission on product line, per-row (affiliate share of product commission). */
  productCommission: number;
  /** Total cost paid by seller = commission + Shopee 8% fee. Primary metric. */
  chiPhi: number;
}

const HEADER_MAP = {
  orderId: 'Mã đơn hàng',
  status: 'Trạng thái đơn hàng',
  productId: 'Mã sản phẩm',
  productName: 'Tên sản phẩm',
  quantity: 'Số lượng',
  productCommission: 'Hoa hồng Xtra trên sản phẩm(₫)',
  chiPhi: 'Chi phí(₫)',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class ShopeeAffiliateParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_HEADER' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'ShopeeAffiliateParseError';
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const n = Number(String(s).replace(/[, "]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export async function parseShopeeAffiliate(buffer: ArrayBuffer): Promise<ShopeeAffiliateRow[]> {
  let text: string;
  try {
    text = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  } catch (err) {
    throw new ShopeeAffiliateParseError(
      `Failed to decode CSV: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new ShopeeAffiliateParseError('No data rows', 'EMPTY_FILE');
  }
  const headers = parseCsvLine(lines[0]!).map((h) => h.normalize('NFC'));
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];
  for (const [field, label] of Object.entries(HEADER_MAP) as Array<[FieldName, string]>) {
    const labelNfc = label.normalize('NFC');
    const idx = headers.findIndex((h) => h.trim() === labelNfc);
    if (idx < 0) missing.push(label);
    else colByField[field] = idx;
  }
  if (missing.length > 0) {
    throw new ShopeeAffiliateParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeAffiliateRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    if (cells.length < headers.length - 5) continue;
    rows.push({
      orderId: cells[colByField.orderId]?.trim() ?? '',
      status: cells[colByField.status]?.trim() ?? '',
      productId: cells[colByField.productId]?.trim() ?? '',
      productName: cells[colByField.productName]?.trim() ?? '',
      quantity: num(cells[colByField.quantity]),
      productCommission: num(cells[colByField.productCommission]),
      chiPhi: num(cells[colByField.chiPhi]),
    });
  }
  return rows;
}

export function aggregateAffiliate(rows: ShopeeAffiliateRow[]) {
  let totalCost = 0;
  let totalPureCommission = 0;
  const orderIds = new Set<string>();
  const statusCounts = new Map<string, number>();
  for (const r of rows) {
    totalCost += r.chiPhi;
    totalPureCommission += r.productCommission;
    orderIds.add(r.orderId);
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }
  return {
    totalCost,
    totalPureCommission,
    rowCount: rows.length,
    orderCount: orderIds.size,
    statusBreakdown: Object.fromEntries(statusCounts),
  };
}
