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
 * One row from a Shopee Brand Consideration Ads export (.csv or .xlsx).
 * Aggregate by SUM(cost) for Total Brand Ads — platform-level metric.
 * Per-product allocation downstream is by NMV contribution (skill §6).
 */
export interface ShopeeBrandAdsRow {
  campaignName: string;
  campaignId: string;
  status: string;
  startDate: string;
  endDate: string;
  budget: number;
  views: number;
  clicks: number;
  reach: number;
  cost: number;
}

// Shopee Brand Ads export comes in two flavours:
//   - CSV (vi locale): "Tên chiến dịch", "Số lượt xem", "Chi phí" …
//   - XLSX (en locale): "Campaign Name", "Impression", "Expense" …
// Map every field to BOTH aliases — the resolver picks whichever the row has.
const HEADER_MAP = {
  campaignName: ['Tên chiến dịch', 'Campaign Name'],
  campaignId: ['ID chiến dịch', 'Campaign ID'],
  status: ['Trạng thái', 'Status'],
  startDate: ['Ngày bắt đầu', 'Start Date'],
  endDate: ['Ngày kết thúc', 'End Date'],
  budget: ['Ngân sách', 'Budget'],
  views: ['Số lượt xem', 'Impression', 'Impressions'],
  clicks: ['Số lượt click', 'Clicks'],
  reach: ['Lượt tiếp cận', 'Reach'],
  cost: ['Chi phí', 'Expense'],
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class ShopeeBrandAdsParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_HEADER' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'ShopeeBrandAdsParseError';
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

export async function parseShopeeBrandAds(buffer: ArrayBuffer): Promise<ShopeeBrandAdsRow[]> {
  const bytes = new Uint8Array(buffer);
  if (isXlsx(bytes)) return parseShopeeBrandAdsXlsx(bytes);
  return parseShopeeBrandAdsCsv(buffer);
}

function parseShopeeBrandAdsCsv(buffer: ArrayBuffer): ShopeeBrandAdsRow[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  } catch (err) {
    throw new ShopeeBrandAdsParseError(
      `Failed to decode CSV: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const lines = text.split(/\r?\n/);
  // CSV variant uses Vietnamese headers and has a "Thứ tự" leading column.
  // Some Shopee CSV exports mix NFC + NFD forms within the same line —
  // normalize both sides before comparing.
  const headerIdx = lines.findIndex((l) => l.startsWith('Thứ tự,'));
  if (headerIdx < 0) {
    throw new ShopeeBrandAdsParseError(
      'Header row "Thứ tự," not found — not a Shopee Brand Ads CSV?',
      'NO_HEADER',
    );
  }
  const headers = parseCsvLine(lines[headerIdx]!).map((h) => h.normalize('NFC').trim());
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
    throw new ShopeeBrandAdsParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeBrandAdsRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = parseCsvLine(line);
    if (cells.length < headers.length - 2) continue;
    rows.push({
      campaignName: cells[colByField.campaignName]?.trim() ?? '',
      campaignId: cells[colByField.campaignId]?.trim() ?? '',
      status: cells[colByField.status]?.trim() ?? '',
      startDate: cells[colByField.startDate]?.trim() ?? '',
      endDate: cells[colByField.endDate]?.trim() ?? '',
      budget: num(cells[colByField.budget]),
      views: num(cells[colByField.views]),
      clicks: num(cells[colByField.clicks]),
      reach: num(cells[colByField.reach]),
      cost: num(cells[colByField.cost]),
    });
  }
  // Brand Ads may legitimately have 0 active campaigns in a week — don't throw on empty.
  return rows;
}

function parseShopeeBrandAdsXlsx(bytes: Uint8Array): ShopeeBrandAdsRow[] {
  let grid: Map<number, Map<number, string | number>>;
  try {
    grid = readXlsxGrid(bytes);
  } catch (err) {
    if (err instanceof XlsxParseError) {
      throw new ShopeeBrandAdsParseError(err.message, 'READ_FAILED');
    }
    throw err;
  }
  // Brand Ads xlsx export drops the "Thứ tự" leading column AND uses English
  // headers (Campaign Name, Impression, Expense …), so we can't pin to col A
  // or to the Vietnamese labels. Flatten all aliases and count matches.
  const allLabels: string[] = Object.values(HEADER_MAP).flatMap((a) => [...a]);
  const headerRowNum = findHeaderRowByLabels(grid, allLabels, 4);
  if (headerRowNum < 0) {
    const sampleEn = HEADER_MAP.campaignName[1]!; // "Campaign Name"
    const sampleVi = HEADER_MAP.campaignName[0]!; // "Tên chiến dịch"
    throw new ShopeeBrandAdsParseError(
      `Header row not found in xlsx — expected columns like "${sampleEn}" / "${sampleVi}"`,
      'NO_HEADER',
    );
  }
  const { colByField, missing } = resolveHeaderColumns(grid.get(headerRowNum)!, HEADER_MAP);
  if (missing.length > 0) {
    throw new ShopeeBrandAdsParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: ShopeeBrandAdsRow[] = [];
  const maxRow = Math.max(...grid.keys());
  for (let r = headerRowNum + 1; r <= maxRow; r++) {
    const row = grid.get(r);
    if (!row) continue;
    // Real data row must have a campaign name (col-A leader column varies).
    const name = cellText(row.get(colByField.campaignName));
    if (!name) continue;
    rows.push({
      campaignName: cellText(row.get(colByField.campaignName)),
      campaignId: cellText(row.get(colByField.campaignId)),
      status: cellText(row.get(colByField.status)),
      startDate: cellText(row.get(colByField.startDate)),
      endDate: cellText(row.get(colByField.endDate)),
      budget: cellNumber(row.get(colByField.budget)),
      views: cellNumber(row.get(colByField.views)),
      clicks: cellNumber(row.get(colByField.clicks)),
      reach: cellNumber(row.get(colByField.reach)),
      cost: cellNumber(row.get(colByField.cost)),
    });
  }
  // Brand Ads may legitimately have 0 active campaigns in a week — don't throw on empty.
  return rows;
}

export function aggregateBrandAds(rows: ShopeeBrandAdsRow[]) {
  let totalCost = 0;
  for (const r of rows) totalCost += r.cost;
  return {
    totalCost,
    campaignCount: rows.length,
    activeCampaignCount: rows.filter((r) => r.cost > 0).length,
  };
}
