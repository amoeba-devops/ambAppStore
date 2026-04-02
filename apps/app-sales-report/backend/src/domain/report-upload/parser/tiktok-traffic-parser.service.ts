import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/** Parse TikTok money: "192.612.578₫" → 192612578, "1,23%" → 0.0123 */
function parseTikTokMoney(v: unknown): number | null {
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
  const s = String(v).trim().replace(/\./g, '').replace(',', '.').replace(/₫/g, '');
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export interface TikTokTrafficRow {
  productId: string | null;
  productName: string | null;
  status: string | null;
  gmvTotal: number | null;
  unitsSold: number | null;
  orders: number | null;
  shopGmv: number | null;
  shopUnits: number | null;
  shopImpressions: number | null;
  shopPageViews: number | null;
  shopUniqueViews: number | null;
  shopUniqueBuyers: number | null;
  shopCtr: number | null;
  shopConvRate: number | null;
  liveGmv: number | null;
  liveUnits: number | null;
  liveImpressions: number | null;
  livePageViews: number | null;
  liveUniqueViews: number | null;
  liveUniqueBuyers: number | null;
  liveCtr: number | null;
  liveConvRate: number | null;
  videoGmv: number | null;
  videoUnits: number | null;
  videoImpressions: number | null;
  videoPageViews: number | null;
  videoUniqueViews: number | null;
  videoUniqueBuyers: number | null;
  videoCtr: number | null;
  videoConvRate: number | null;
  cardGmv: number | null;
  cardUnits: number | null;
  cardImpressions: number | null;
  cardPageViews: number | null;
  cardUniqueViews: number | null;
  cardUniqueBuyers: number | null;
  cardCtr: number | null;
  cardConvRate: number | null;
}

export interface TikTokTrafficParseResult {
  rows: TikTokTrafficRow[];
  totalRows: number;
  periodStart: string | null;
  periodEnd: string | null;
}

@Injectable()
export class TikTokTrafficParserService {
  async parse(buffer: Buffer): Promise<TikTokTrafficParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const ws = workbook.worksheets[0];
    if (!ws) throw new Error('No worksheet found');

    // Row 1 has date range label, extract period
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    const row1 = ws.getRow(1);
    if (row1) {
      const cellVal = String(row1.getCell(1).value || '');
      // "01/03/2026 - 31/03/2026" or similar
      const m = cellVal.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (m) {
        periodStart = m[1].split('/').reverse().join('-'); // DD/MM/YYYY → YYYY-MM-DD
        periodEnd = m[2].split('/').reverse().join('-');
      }
    }

    const rows: TikTokTrafficRow[] = [];
    let totalRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= 3) return; // Row 1=date meta, Row 2=empty, Row 3=header
      const r = row.values as unknown[];
      const productId = toStr(r[1]);
      if (!productId) return;
      totalRows++;

      rows.push({
        productId,
        productName: toStr(r[2]),
        status: toStr(r[3]),
        gmvTotal: parseTikTokMoney(r[4]),
        unitsSold: toInt(r[5]),
        orders: toInt(r[6]),
        shopGmv: parseTikTokMoney(r[7]),
        shopUnits: toInt(r[8]),
        shopImpressions: toInt(r[9]),
        shopPageViews: toInt(r[10]),
        shopUniqueViews: toInt(r[11]),
        shopUniqueBuyers: toInt(r[12]),
        shopCtr: parseTikTokMoney(r[13]),
        shopConvRate: parseTikTokMoney(r[14]),
        liveGmv: parseTikTokMoney(r[15]),
        liveUnits: toInt(r[16]),
        liveImpressions: toInt(r[17]),
        livePageViews: toInt(r[18]),
        liveUniqueViews: toInt(r[19]),
        liveUniqueBuyers: toInt(r[20]),
        liveCtr: parseTikTokMoney(r[21]),
        liveConvRate: parseTikTokMoney(r[22]),
        videoGmv: parseTikTokMoney(r[23]),
        videoUnits: toInt(r[24]),
        videoImpressions: toInt(r[25]),
        videoPageViews: toInt(r[26]),
        videoUniqueViews: toInt(r[27]),
        videoUniqueBuyers: toInt(r[28]),
        videoCtr: parseTikTokMoney(r[29]),
        videoConvRate: parseTikTokMoney(r[30]),
        cardGmv: parseTikTokMoney(r[31]),
        cardUnits: toInt(r[32]),
        cardImpressions: toInt(r[33]),
        cardPageViews: toInt(r[34]),
        cardUniqueViews: toInt(r[35]),
        cardUniqueBuyers: toInt(r[36]),
        cardCtr: parseTikTokMoney(r[37]),
        cardConvRate: parseTikTokMoney(r[38]),
      });
    });

    return { rows, totalRows, periodStart, periodEnd };
  }
}
