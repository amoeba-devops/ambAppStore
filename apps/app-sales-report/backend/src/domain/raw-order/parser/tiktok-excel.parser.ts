import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  ExcelParser,
  ExcelParseResult,
  ParsedOrder,
  ParsedOrderItem,
} from './excel-parser.interface';

const STATUS_MAP: Record<string, string> = {
  'Đã hoàn tất': 'COMPLETED',
  'Đã hủy': 'CANCELLED',
  'Đã vận chuyển': 'SHIPPING',
  'Đã giao': 'DELIVERED',
  'Đang vận chuyển': 'SHIPPING',
};

function normalizeStatus(raw: string | null): { status: string; statusRaw: string | null } {
  if (!raw) return { status: 'UNKNOWN', statusRaw: null };
  const s = raw.trim();
  for (const [vi, en] of Object.entries(STATUS_MAP)) {
    if (s === vi) return { status: en, statusRaw: s };
  }
  return { status: 'UNKNOWN', statusRaw: s };
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parseTikTokDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  // TikTok format: DD/MM/YYYY HH:mm:ss
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  if (m) {
    const [, day, month, year, time] = m;
    return new Date(`${year}-${month}-${day}T${time}`);
  }
  // Fallback ISO
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * TikTok Shop Excel parser (54-column format, "OrderSKUList" sheet).
 * Row 1 = header, Row 2 = column descriptions (SKIP), Data starts at Row 3.
 * Each row = one order-item line. Multiple rows share the same Order ID.
 *
 * Column indices (1-based for ExcelJS row.values):
 */
@Injectable()
export class TikTokExcelParser implements ExcelParser {
  async parse(buffer: Buffer): Promise<ExcelParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const ws = workbook.getWorksheet('OrderSKUList') || workbook.worksheets[0];
    if (!ws) throw new Error('No worksheet found');

    const orderMap = new Map<string, ParsedOrder>();
    let totalRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= 2) return; // skip header + description row
      const r = row.values as unknown[];
      // ExcelJS: r[0] is empty, r[1] = col A
      const orderId = toStr(r[1]);
      if (!orderId) return;
      totalRows++;

      if (!orderMap.has(orderId)) {
        const { status, statusRaw } = normalizeStatus(toStr(r[2]));

        // Completion date
        let completedAt: Date | null = null;
        if (status === 'CANCELLED') {
          completedAt = parseTikTokDate(r[30]);
        } else if (status === 'COMPLETED' || status === 'DELIVERED') {
          completedAt = parseTikTokDate(r[29]);
        }

        const order: ParsedOrder = {
          channelOrderId: orderId,
          packageId: toStr(r[51]),
          orderDate: parseTikTokDate(r[25]) || new Date(),
          status,
          statusRaw,
          cancelReason: toStr(r[32]),
          trackingNo: toStr(r[35]),
          carrier: toStr(r[37]),
          deliveryMethod: toStr(r[33]),
          orderType: toStr(r[5]),
          estDeliveryDate: null,
          shipDate: parseTikTokDate(r[27]),
          deliveryTime: parseTikTokDate(r[29]),
          totalWeightKg: null,
          totalVnd: toNum(r[23]),
          shopVoucher: null,
          coinCashback: null,
          shopeeVoucher: null,
          promoCombo: null,
          shopeeComboDiscount: null,
          shopComboDiscount: null,
          shopeeCoinRebate: null,
          cardDiscount: toNum(r[21]),
          tradeInDiscount: null,
          tradeInBonus: null,
          sellerTradeInBonus: null,
          shippingFeeEst: toNum(r[18]),
          buyerShippingFee: toNum(r[17]),
          shopeeShippingSubsidy: null,
          returnShippingFee: null,
          totalBuyerPayment: toNum(r[23]),
          completedAt,
          paidAt: parseTikTokDate(r[26]),
          paymentMethod: toStr(r[48]),
          commissionFee: null,
          serviceFee: null,
          paymentFee: null,
          deposit: null,
          province: toStr(r[43]),
          district: toStr(r[44]),
          country: toStr(r[42]),
          items: [],
        };
        orderMap.set(orderId, order);
      }

      const order = orderMap.get(orderId)!;
      const cancelReturnType = toStr(r[4]);
      const returnStatus = cancelReturnType && cancelReturnType.toLowerCase() !== 'cancel'
        ? cancelReturnType
        : null;

      const item: ParsedOrderItem = {
        productSku: toStr(r[7]),
        productName: toStr(r[8]),
        variantSku: toStr(r[7]),  // Seller SKU = variant key for matching
        variantName: toStr(r[9]),
        isBestseller: false,
        weightKg: toNum(r[49]),
        originalPrice: toNum(r[12]),
        sellerDiscount: toNum(r[15]),
        platformDiscount: toNum(r[14]),
        totalSellerSubsidy: null,
        dealPrice: toNum(r[16]),
        quantity: toNum(r[10]) || 1,
        returnQuantity: toNum(r[11]) || 0,
        buyerPaid: toNum(r[16]),
        returnStatus,
      };
      order.items.push(item);
    });

    return { orders: Array.from(orderMap.values()), totalRows };
  }
}
