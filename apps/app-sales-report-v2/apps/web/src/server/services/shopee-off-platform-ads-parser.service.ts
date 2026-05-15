import 'server-only';

/**
 * One daily row from a Shopee Off-Platform Ads CSV export.
 * File is plain CSV (no metadata header), 1 row per day in the date range.
 * Total Off-Platform Ads = SUM of `costVnd` across all rows.
 */
export interface ShopeeOffPlatformAdsRow {
  date: string;
  impressions: number;
  clicks: number;
  orders: number;
  gmvVnd: number;
  costVnd: number;
  roi: number;
}

const HEADER_MAP = {
  date: 'Ngày',
  impressions: 'Lượt hiển thị',
  clicks: 'Lượt click',
  orders: 'Đơn hàng',
  gmvVnd: 'GMV(VND)',
  costVnd: 'Chi phí(VND)',
  roi: 'ROI',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class ShopeeOffPlatformAdsParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_HEADER' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'ShopeeOffPlatformAdsParseError';
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
  const n = Number(String(s).replace(/[, "%]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export async function parseShopeeOffPlatformAds(buffer: ArrayBuffer): Promise<ShopeeOffPlatformAdsRow[]> {
  let text: string;
  try {
    text = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  } catch (err) {
    throw new ShopeeOffPlatformAdsParseError(
      `Failed to decode CSV: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new ShopeeOffPlatformAdsParseError('No data rows', 'EMPTY_FILE');
  }
  // First non-empty line is the header (plain CSV — no metadata block here)
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
    throw new ShopeeOffPlatformAdsParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeOffPlatformAdsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    if (cells.length < headers.length - 2) continue;
    rows.push({
      date: cells[colByField.date]?.trim() ?? '',
      impressions: num(cells[colByField.impressions]),
      clicks: num(cells[colByField.clicks]),
      orders: num(cells[colByField.orders]),
      gmvVnd: num(cells[colByField.gmvVnd]),
      costVnd: num(cells[colByField.costVnd]),
      roi: num(cells[colByField.roi]),
    });
  }
  return rows;
}

export function aggregateOffPlatformAds(rows: ShopeeOffPlatformAdsRow[]) {
  let totalCost = 0;
  let totalGmv = 0;
  let totalOrders = 0;
  for (const r of rows) {
    totalCost += r.costVnd;
    totalGmv += r.gmvVnd;
    totalOrders += r.orders;
  }
  return {
    totalCost,
    totalGmv,
    totalOrders,
    dayCount: rows.length,
  };
}
