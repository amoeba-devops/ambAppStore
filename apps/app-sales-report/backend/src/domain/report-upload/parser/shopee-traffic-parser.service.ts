import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/** Parse Vietnamese locale number: "565.063.917" → 565063917, "1,77%" → 0.0177 */
function parseViNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s || s === '-') return null;
  // Percentage: "1,77%"
  if (s.endsWith('%')) {
    const num = parseFloat(s.replace('%', '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num / 100;
  }
  // Number with dots as thousands: "565.063.917"
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
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export interface ShopeeTrafficRow {
  productId: string | null;
  productName: string | null;
  productStatus: string | null;
  variantId: string | null;
  variantName: string | null;
  variantSku: string | null;
  productSku: string | null;
  revenuePlaced: number | null;
  revenueConfirmed: number | null;
  views: number | null;
  clicks: number | null;
  ctr: number | null;
  convRatePlaced: number | null;
  convRateConfirmed: number | null;
  ordersPlaced: number | null;
  ordersConfirmed: number | null;
  unitsPlaced: number | null;
  unitsConfirmed: number | null;
  uniqueImpressions: number | null;
  uniqueClicks: number | null;
  searchClicks: number | null;
  addToCartVisits: number | null;
  addToCartUnits: number | null;
  cartConvRate: number | null;
}

export interface ShopeeTrafficParseResult {
  rows: ShopeeTrafficRow[];
  totalRows: number;
}

@Injectable()
export class ShopeeTrafficParserService {
  async parse(buffer: Buffer): Promise<ShopeeTrafficParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    // Primary sheet: "Sản Phẩm Hiệu Quả Tốt" or first sheet
    const ws = workbook.getWorksheet('Sản Phẩm Hiệu Quả Tốt') || workbook.worksheets[0];
    if (!ws) throw new Error('No worksheet found');

    const rows: ShopeeTrafficRow[] = [];
    let totalRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= 1) return; // skip header
      const r = row.values as unknown[];
      // r[0] is empty (ExcelJS 1-indexed), r[1]=C00
      const productId = toStr(r[1]);
      if (!productId) return;
      totalRows++;

      rows.push({
        productId,
        productName: toStr(r[2]),
        productStatus: toStr(r[3]),
        variantId: toStr(r[4]),
        variantName: toStr(r[5]),
        variantSku: toStr(r[7]),    // C06 = variant SKU
        productSku: toStr(r[8]),    // C07 = product SKU
        revenuePlaced: parseViNum(r[9]),
        revenueConfirmed: parseViNum(r[10]),
        views: toInt(r[11]),
        clicks: toInt(r[12]),
        ctr: parseViNum(r[13]),
        convRatePlaced: parseViNum(r[14]),
        convRateConfirmed: parseViNum(r[15]),
        ordersPlaced: toInt(r[16]),
        ordersConfirmed: toInt(r[17]),
        unitsPlaced: toInt(r[18]),
        unitsConfirmed: toInt(r[19]),
        uniqueImpressions: toInt(r[26]),
        uniqueClicks: toInt(r[27]),
        searchClicks: toInt(r[32]),
        addToCartVisits: toInt(r[34]),
        addToCartUnits: toInt(r[35]),
        cartConvRate: parseViNum(r[36]),
      });
    });

    return { rows, totalRows };
  }
}
