import { Injectable } from '@nestjs/common';
import * as csv from 'csv-parse/sync';

function parseViMoney(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '-' || s === 'N/A') return null;
  if (s.endsWith('%')) {
    const num = parseFloat(s.replace('%', '').replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num / 100;
  }
  // Remove ₫ and Vietnamese locale format
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
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function parseDate(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface ShopeeAffiliateRow {
  orderId: string | null;
  status: string | null;
  fraudStatus: string | null;
  orderTime: Date | null;
  productId: string | null;
  productName: string | null;
  modelId: string | null;
  categoryL1: string | null;
  categoryL2: string | null;
  categoryL3: string | null;
  price: number | null;
  quantity: number | null;
  partnerName: string | null;
  affiliateAccount: string | null;
  mcn: string | null;
  commissionRate: number | null;
  commissionAmount: number | null;
  sellerCommission: number | null;
  platformCommission: number | null;
  totalCost: number | null;
  deductionStatus: string | null;
  channel: string | null;
}

export interface ShopeeAffiliateParseResult {
  rows: ShopeeAffiliateRow[];
  totalRows: number;
}

@Injectable()
export class ShopeeAffiliateParserService {
  async parse(buffer: Buffer): Promise<ShopeeAffiliateParseResult> {
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.substring(1);
    }

    const records = csv.parse(text, {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];

    if (records.length < 2) return { rows: [], totalRows: 0 };

    // Row 0 = header, Row 1+ = data
    const dataRows = records.slice(1);

    const rows: ShopeeAffiliateRow[] = [];
    for (const r of dataRows) {
      const orderId = toStr(r[0]);
      if (!orderId) continue;

      rows.push({
        orderId,
        status: toStr(r[1]),
        fraudStatus: toStr(r[2]),
        orderTime: parseDate(r[3]),
        productId: toStr(r[6]),
        productName: toStr(r[7]),
        modelId: toStr(r[8]),
        categoryL1: toStr(r[9]),
        categoryL2: toStr(r[10]),
        categoryL3: toStr(r[11]),
        price: parseViMoney(r[13]),
        quantity: toInt(r[14]),
        partnerName: toStr(r[15]),
        affiliateAccount: toStr(r[16]),
        mcn: toStr(r[17]),
        commissionRate: parseViMoney(r[26]),
        commissionAmount: parseViMoney(r[24]),
        sellerCommission: parseViMoney(r[25]),
        platformCommission: parseViMoney(r[27]),
        totalCost: parseViMoney(r[34]),
        deductionStatus: toStr(r[35]),
        channel: toStr(r[33]),
      });
    }

    return { rows, totalRows: rows.length };
  }
}
