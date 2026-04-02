import { Injectable } from '@nestjs/common';
import * as csv from 'csv-parse/sync';

function parseViNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === 'N/A') return null;
  if (s.endsWith('%')) {
    const num = parseFloat(s.replace('%', '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num / 100;
  }
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toInt(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function parseShopeeDate(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // DD/MM/YYYY format
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface ShopeeAdRow {
  adName: string | null;
  status: string | null;
  adType: string | null;
  productId: string | null;
  bidMethod: string | null;
  placement: string | null;
  startDate: Date | null;
  endDate: Date | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  conversions: number | null;
  directConversions: number | null;
  convRate: number | null;
  directConvRate: number | null;
  costPerConversion: number | null;
  costPerDirect: number | null;
  productsSold: number | null;
  directProductsSold: number | null;
  totalSales: number | null;
  directSales: number | null;
  totalCost: number | null;
  roas: number | null;
}

export interface ShopeeAdParseResult {
  rows: ShopeeAdRow[];
  totalRows: number;
  periodStart: string | null;
  periodEnd: string | null;
}

@Injectable()
export class ShopeeAdParserService {
  async parse(buffer: Buffer): Promise<ShopeeAdParseResult> {
    // Remove UTF-8 BOM
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.substring(1);
    }

    const lines = text.split(/\r?\n/);

    // Extract period from metadata rows (Row 5, 0-indexed: "01/03/2026 - 31/03/2026")
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    if (lines.length > 5) {
      const periodLine = lines[5];
      const m = periodLine.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (m) {
        periodStart = m[1].split('/').reverse().join('-');
        periodEnd = m[2].split('/').reverse().join('-');
      }
    }

    // Data starts at row 7 (0-indexed), row 7 = header, row 8+ = data
    const dataText = lines.slice(7).join('\n');
    if (!dataText.trim()) return { rows: [], totalRows: 0, periodStart, periodEnd };

    const records = csv.parse(dataText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const rows: ShopeeAdRow[] = [];
    const headers = Object.keys(records[0] || {});

    for (const rec of records) {
      const vals = Object.values(rec);
      // Skip empty rows or summary rows
      if (!vals[1]) continue;

      rows.push({
        adName: toStr(vals[1]),
        status: toStr(vals[2]),
        adType: toStr(vals[3]),
        productId: toStr(vals[4]),
        bidMethod: toStr(vals[6]),
        placement: toStr(vals[7]),
        startDate: parseShopeeDate(vals[8]),
        endDate: parseShopeeDate(vals[9]),
        impressions: toInt(vals[10]),
        clicks: toInt(vals[11]),
        ctr: parseViNum(vals[12]),
        conversions: toInt(vals[13]),
        directConversions: toInt(vals[14]),
        convRate: parseViNum(vals[15]),
        directConvRate: parseViNum(vals[16]),
        costPerConversion: parseViNum(vals[17]),
        costPerDirect: parseViNum(vals[18]),
        productsSold: toInt(vals[19]),
        directProductsSold: toInt(vals[20]),
        totalSales: parseViNum(vals[21]),
        directSales: parseViNum(vals[22]),
        totalCost: parseViNum(vals[23]),
        roas: parseViNum(vals[24]),
      });
    }

    return { rows, totalRows: rows.length, periodStart, periodEnd };
  }
}
