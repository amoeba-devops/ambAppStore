import 'server-only';

/**
 * One row from a Shopee Brand Consideration Ads CSV export.
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

const HEADER_MAP = {
  campaignName: 'Tên chiến dịch',
  campaignId: 'ID chiến dịch',
  status: 'Trạng thái',
  startDate: 'Ngày bắt đầu',
  endDate: 'Ngày kết thúc',
  budget: 'Ngân sách',
  views: 'Số lượt xem',
  clicks: 'Số lượt click',
  reach: 'Lượt tiếp cận',
  cost: 'Chi phí',
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
  const headerIdx = lines.findIndex((l) => l.startsWith('Thứ tự,'));
  if (headerIdx < 0) {
    throw new ShopeeBrandAdsParseError(
      'Header row "Thứ tự," not found — not a Shopee Brand Ads CSV?',
      'NO_HEADER',
    );
  }
  // CSV header line in some Shopee exports mixes Unicode NFC + NFD forms
  // within the same line — normalize both sides to NFC before comparing.
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

export function aggregateBrandAds(rows: ShopeeBrandAdsRow[]) {
  let totalCost = 0;
  for (const r of rows) totalCost += r.cost;
  return {
    totalCost,
    campaignCount: rows.length,
    activeCampaignCount: rows.filter((r) => r.cost > 0).length,
  };
}
