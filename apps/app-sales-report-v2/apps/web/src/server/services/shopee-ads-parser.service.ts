import 'server-only';

/**
 * One campaign row from a Shopee Ads (Dịch vụ Hiển thị CPC) CSV export.
 * Per-product campaigns join to Sales via `productId` = "SKU sản phẩm" (col 16
 * of Sales). Shop-wide campaigns (e.g. "Shop GMV Max") have productId="-" or
 * empty and apply at platform level.
 */
export interface ShopeeAdsRow {
  /** Empty / "-" for shop-wide campaigns. */
  productId: string;
  campaignName: string;
  status: string;
  serviceType: string;
  views: number;
  clicks: number;
  conversions: number;
  productsSold: number;
  revenue: number;
  /** Ad cost in VND — the primary metric (sum gives Total Ad Spending). */
  cost: number;
  voucherAmount: number;
  voucheredSales: number;
  isShopWide: boolean;
}

const HEADER_MAP = {
  campaignName: 'Tên Dịch vụ Hiển thị',
  status: 'Trạng thái',
  serviceType: 'Loại Dịch vụ Hiển thị',
  productId: 'Mã sản phẩm',
  views: 'Số lượt xem',
  clicks: 'Số lượt click',
  conversions: 'Lượt chuyển đổi',
  productsSold: 'Sản phẩm đã bán',
  revenue: 'Doanh số',
  cost: 'Chi phí',
  voucherAmount: 'Voucher Amount',
  voucheredSales: 'Vouchered Sales',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class ShopeeAdsParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_HEADER' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'ShopeeAdsParseError';
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

/**
 * Parse a Shopee Ads (CPC Display Service) CSV export.
 *
 * The file has a metadata block (6-7 lines, "Báo cáo Dịch vụ Hiển thị…",
 * username, shop name, date range, etc.), then a blank line, then the column
 * header row starting with "Thứ tự,", then data rows.
 */
export async function parseShopeeAds(buffer: ArrayBuffer): Promise<ShopeeAdsRow[]> {
  let text: string;
  try {
    text = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  } catch (err) {
    throw new ShopeeAdsParseError(
      `Failed to decode CSV: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.startsWith('Thứ tự,'));
  if (headerIdx < 0) {
    throw new ShopeeAdsParseError(
      'Header row "Thứ tự," not found — not a Shopee Ads CSV?',
      'NO_HEADER',
    );
  }
  // Normalize Unicode (NFC) — Shopee CSV exports sometimes mix NFC + NFD forms.
  const headers = parseCsvLine(lines[headerIdx]!).map((h) => h.normalize('NFC'));
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];
  for (const [field, label] of Object.entries(HEADER_MAP) as Array<[FieldName, string]>) {
    const labelNfc = label.normalize('NFC');
    const idx = headers.findIndex((h) => h.trim() === labelNfc);
    if (idx < 0) missing.push(label);
    else colByField[field] = idx;
  }
  if (missing.length > 0) {
    throw new ShopeeAdsParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeAdsRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = parseCsvLine(line);
    if (cells.length < headers.length - 2) continue; // skip malformed

    const productId = cells[colByField.productId]?.trim() ?? '';
    const isShopWide = !productId || productId === '-';

    rows.push({
      productId,
      campaignName: cells[colByField.campaignName]?.trim() ?? '',
      status: cells[colByField.status]?.trim() ?? '',
      serviceType: cells[colByField.serviceType]?.trim() ?? '',
      views: num(cells[colByField.views]),
      clicks: num(cells[colByField.clicks]),
      conversions: num(cells[colByField.conversions]),
      productsSold: num(cells[colByField.productsSold]),
      revenue: num(cells[colByField.revenue]),
      cost: num(cells[colByField.cost]),
      voucherAmount: num(cells[colByField.voucherAmount]),
      voucheredSales: num(cells[colByField.voucheredSales]),
      isShopWide,
    });
  }

  if (rows.length === 0) {
    throw new ShopeeAdsParseError('No data rows in Shopee Ads CSV', 'EMPTY_FILE');
  }
  return rows;
}

/**
 * Aggregate ad rows into Total Ad Spending + breakdowns.
 * Pure function.
 */
export function aggregateAds(rows: ShopeeAdsRow[]) {
  let totalCost = 0;
  let shopWideCost = 0;
  let productSpecificCost = 0;
  const perProduct = new Map<
    string,
    { productId: string; campaignName: string; cost: number; sold: number; revenue: number }
  >();

  for (const r of rows) {
    totalCost += r.cost;
    if (r.isShopWide) {
      shopWideCost += r.cost;
    } else {
      productSpecificCost += r.cost;
      const prev = perProduct.get(r.productId) ?? {
        productId: r.productId,
        campaignName: r.campaignName,
        cost: 0,
        sold: 0,
        revenue: 0,
      };
      prev.cost += r.cost;
      prev.sold += r.productsSold;
      prev.revenue += r.revenue;
      perProduct.set(r.productId, prev);
    }
  }
  return {
    totalCost,
    shopWideCost,
    productSpecificCost,
    campaignCount: rows.length,
    productSpecificCount: perProduct.size,
    perProduct: [...perProduct.values()].sort((a, b) => b.cost - a.cost),
  };
}
