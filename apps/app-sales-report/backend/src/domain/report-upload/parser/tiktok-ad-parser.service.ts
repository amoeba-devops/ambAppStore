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
  // DD/MM/YYYY HH:mm
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:00`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface TikTokAdRow {
  campaignName: string | null;
  campaignId: string | null;
  productId: string | null;
  creativeType: string | null;
  videoTitle: string | null;
  videoId: string | null;
  account: string | null;
  postTime: Date | null;
  status: string | null;
  authType: string | null;
  cost: number | null;
  skuOrders: number | null;
  costPerOrder: number | null;
  grossRevenue: number | null;
  roi: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  convRate: number | null;
  view2sRate: number | null;
  view6sRate: number | null;
  view25Rate: number | null;
  view50Rate: number | null;
  view75Rate: number | null;
  view100Rate: number | null;
  currency: string | null;
}

export interface TikTokAdParseResult {
  rows: TikTokAdRow[];
  totalRows: number;
}

@Injectable()
export class TikTokAdParserService {
  async parse(buffer: Buffer): Promise<TikTokAdParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const ws = workbook.getWorksheet('Data') || workbook.worksheets[0];
    if (!ws) throw new Error('No worksheet found');

    const rows: TikTokAdRow[] = [];
    let totalRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= 1) return; // skip header
      const r = row.values as unknown[];
      const campaignName = toStr(r[1]);
      if (!campaignName) return;
      totalRows++;

      rows.push({
        campaignName,
        campaignId: toStr(r[2]),
        productId: toStr(r[3]),
        creativeType: toStr(r[4]),
        videoTitle: toStr(r[5]),
        videoId: toStr(r[6]),
        account: toStr(r[7]),
        postTime: toDate(r[8]),
        status: toStr(r[9]),
        authType: toStr(r[10]),
        cost: parseMoney(r[11]),
        skuOrders: toInt(r[12]),
        costPerOrder: parseMoney(r[13]),
        grossRevenue: parseMoney(r[14]),
        roi: parseMoney(r[15]),
        impressions: toInt(r[16]),
        clicks: toInt(r[17]),
        ctr: parseMoney(r[18]),
        convRate: parseMoney(r[19]),
        view2sRate: parseMoney(r[20]),
        view6sRate: parseMoney(r[21]),
        view25Rate: parseMoney(r[22]),
        view50Rate: parseMoney(r[23]),
        view75Rate: parseMoney(r[24]),
        view100Rate: parseMoney(r[25]),
        currency: toStr(r[26]),
      });
    });

    return { rows, totalRows };
  }
}
