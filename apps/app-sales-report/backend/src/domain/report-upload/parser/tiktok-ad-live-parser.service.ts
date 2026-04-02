import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s || s === '-') return null;
  if (s.endsWith('%')) {
    const num = parseFloat(s.replace('%', '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num / 100;
  }
  const cleaned = s.replace(/₫/g, '').replace(/\./g, '').replace(',', '.').trim();
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
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:00`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface TikTokAdLiveRow {
  liveName: string | null;
  launchTime: Date | null;
  status: string | null;
  campaignName: string | null;
  campaignId: string | null;
  cost: number | null;
  netCost: number | null;
  skuOrders: number | null;
  skuOrdersShop: number | null;
  costPerOrder: number | null;
  grossRevenue: number | null;
  grossRevenueShop: number | null;
  roiShop: number | null;
  liveViews: number | null;
  costPerView: number | null;
  liveViews10s: number | null;
  costPer10sView: number | null;
  liveFollowers: number | null;
  currency: string | null;
}

export interface TikTokAdLiveParseResult {
  rows: TikTokAdLiveRow[];
  totalRows: number;
}

@Injectable()
export class TikTokAdLiveParserService {
  async parse(buffer: Buffer): Promise<TikTokAdLiveParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const ws = workbook.getWorksheet('Data') || workbook.worksheets[0];
    if (!ws) throw new Error('No worksheet found');

    const rows: TikTokAdLiveRow[] = [];
    let totalRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= 1) return;
      const r = row.values as unknown[];
      const liveName = toStr(r[1]);
      if (!liveName) return;
      totalRows++;

      rows.push({
        liveName,
        launchTime: toDate(r[2]),
        status: toStr(r[3]),
        campaignName: toStr(r[4]),
        campaignId: toStr(r[5]),
        cost: parseMoney(r[6]),
        netCost: parseMoney(r[7]),
        skuOrders: toInt(r[8]),
        skuOrdersShop: toInt(r[9]),
        costPerOrder: parseMoney(r[10]),
        grossRevenue: parseMoney(r[11]),
        grossRevenueShop: parseMoney(r[12]),
        roiShop: parseMoney(r[13]),
        liveViews: toInt(r[14]),
        costPerView: parseMoney(r[15]),
        liveViews10s: toInt(r[16]),
        costPer10sView: parseMoney(r[17]),
        liveFollowers: toInt(r[18]),
        currency: toStr(r[19]),
      });
    });

    return { rows, totalRows };
  }
}
