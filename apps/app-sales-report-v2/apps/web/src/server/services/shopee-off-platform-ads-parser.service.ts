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
 * One daily row from a Shopee Off-Platform Ads export (.csv or .xlsx).
 *   - CSV (vi locale): "Ngày", "Lượt hiển thị", "Chi phí(VND)" …
 *     header sits on row 1, no leading metadata columns
 *   - XLSX (vi locale): same labels, but with 3 extra leading columns
 *     (Shop ID, Tên Shop, Khoảng thời gian) — so "Ngày" is in col D, not A
 * English aliases are also accepted defensively in case the locale flips.
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

// Each field lists every alias we've seen in Seller Center exports (vi + en).
// Resolver picks whichever appears in the actual header row.
const HEADER_MAP = {
  date: ['Ngày', 'Date'],
  impressions: ['Lượt hiển thị', 'Impressions', 'Impression'],
  clicks: ['Lượt click', 'Clicks', 'Click'],
  orders: ['Đơn hàng', 'Orders', 'Order'],
  gmvVnd: ['GMV(VND)', 'GMV (VND)', 'GMV'],
  costVnd: ['Chi phí(VND)', 'Chi phí (VND)', 'Expense(VND)', 'Expense (VND)', 'Expense', 'Cost(VND)', 'Cost'],
  roi: ['ROI'],
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
  const bytes = new Uint8Array(buffer);
  if (isXlsx(bytes)) return parseShopeeOffPlatformAdsXlsx(bytes);
  return parseShopeeOffPlatformAdsCsv(buffer);
}

function parseShopeeOffPlatformAdsCsv(buffer: ArrayBuffer): ShopeeOffPlatformAdsRow[] {
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
  const headers = parseCsvLine(lines[0]!).map((h) => h.normalize('NFC').trim());
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];
  for (const [field, aliases] of Object.entries(HEADER_MAP) as Array<
    [FieldName, readonly string[]]
  >) {
    let idx = -1;
    for (const alias of aliases) {
      idx = headers.findIndex((h) => h === alias.normalize('NFC'));
      if (idx >= 0) break;
    }
    if (idx < 0) missing.push(aliases[0]!);
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

function parseShopeeOffPlatformAdsXlsx(bytes: Uint8Array): ShopeeOffPlatformAdsRow[] {
  let grid: Map<number, Map<number, string | number>>;
  try {
    grid = readXlsxGrid(bytes);
  } catch (err) {
    if (err instanceof XlsxParseError) {
      throw new ShopeeOffPlatformAdsParseError(err.message, 'READ_FAILED');
    }
    throw err;
  }
  // "Ngày" doesn't live in column A — xlsx export has leading metadata
  // columns (Shop ID, Tên Shop, Khoảng thời gian). Scan rows by label-match
  // instead so we find the header regardless of column position.
  const allLabels: string[] = Object.values(HEADER_MAP).flatMap((a) => [...a]);
  const headerRowNum = findHeaderRowByLabels(grid, allLabels, 4);
  if (headerRowNum < 0) {
    throw new ShopeeOffPlatformAdsParseError(
      'Header row not found in xlsx — expected columns like "Ngày" / "Date"',
      'NO_HEADER',
    );
  }
  const { colByField, missing } = resolveHeaderColumns(grid.get(headerRowNum)!, HEADER_MAP);
  if (missing.length > 0) {
    throw new ShopeeOffPlatformAdsParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeOffPlatformAdsRow[] = [];
  const maxRow = Math.max(...grid.keys());
  for (let r = headerRowNum + 1; r <= maxRow; r++) {
    const row = grid.get(r);
    if (!row) continue;
    const date = cellText(row.get(colByField.date));
    if (!date) continue; // skip blanks / totals row
    rows.push({
      date,
      impressions: cellNumber(row.get(colByField.impressions)),
      clicks: cellNumber(row.get(colByField.clicks)),
      orders: cellNumber(row.get(colByField.orders)),
      gmvVnd: cellNumber(row.get(colByField.gmvVnd)),
      costVnd: cellNumber(row.get(colByField.costVnd)),
      roi: cellNumber(row.get(colByField.roi)),
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
