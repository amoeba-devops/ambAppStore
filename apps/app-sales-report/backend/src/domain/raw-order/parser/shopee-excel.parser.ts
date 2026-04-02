import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  ExcelParser,
  ExcelParseResult,
  ParsedOrder,
  ParsedOrderItem,
} from './excel-parser.interface';

const STATUS_MAP: Record<string, string> = {
  'Hoàn thành': 'COMPLETED',
  'Đã hủy': 'CANCELLED',
  'Đã giao': 'DELIVERED',
  'Đang giao': 'SHIPPING',
  'Đã nhận được hàng': 'RECEIVED',
};

function normalizeStatus(raw: string | null): { status: string; statusRaw: string | null } {
  if (!raw) return { status: 'UNKNOWN', statusRaw: null };
  const s = raw.trim();
  for (const [vi, en] of Object.entries(STATUS_MAP)) {
    if (s === vi) return { status: en, statusRaw: s };
  }
  if (s.includes('Người mua xác nhận đã nhận được hàng')) {
    return { status: 'DELIVERED_REFUNDABLE', statusRaw: s };
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

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return null;
  // Try Shopee format: YYYY-MM-DD HH:mm or YYYY-MM-DD HH:mm:ss
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toBool(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim().toUpperCase();
  return ['Y', 'YES', 'TRUE', '1'].includes(s);
}

const RETURN_STATUS_MAP: Record<string, string> = {
  'Đã Chấp Thuận Yêu Cầu': 'APPROVED',
  'Hoàn tất trả hàng': 'RETURNED',
  'Đã giải quyết khiếu nại': 'RESOLVED',
  'Yêu cầu chờ xử lý': 'PENDING',
};

/**
 * Shopee Excel parser (68-column format from "orders" sheet).
 * Row 1 = header, Data starts at Row 2.
 * Each row = one order-item line. Multiple rows share the same Order ID.
 */
@Injectable()
export class ShopeeExcelParser implements ExcelParser {
  async parse(buffer: Buffer): Promise<ExcelParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const ws = workbook.getWorksheet('orders') || workbook.worksheets[0];
    if (!ws) throw new Error('No worksheet found');

    const orderMap = new Map<string, ParsedOrder>();
    let totalRows = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const r = row.values as unknown[];
      // ExcelJS row.values is 1-indexed (index 0 is empty)
      const orderId = toStr(r[1]);
      if (!orderId) return;
      totalRows++;

      if (!orderMap.has(orderId)) {
        const { status, statusRaw } = normalizeStatus(toStr(r[4]));
        const order: ParsedOrder = {
          channelOrderId: orderId,
          packageId: toStr(r[2]),
          orderDate: toDate(r[3]) || new Date(),
          status,
          statusRaw,
          cancelReason: toStr(r[6]),
          trackingNo: toStr(r[8]),
          carrier: toStr(r[9]),
          deliveryMethod: toStr(r[10]),
          orderType: toStr(r[11]),
          estDeliveryDate: toDate(r[12]),
          shipDate: toDate(r[13]),
          deliveryTime: toDate(r[14]),
          totalWeightKg: toNum(r[19]),
          totalVnd: toNum(r[30]),
          shopVoucher: toStr(r[31]),
          coinCashback: toNum(r[32]),
          shopeeVoucher: toStr(r[33]),
          promoCombo: toStr(r[34]),
          shopeeComboDiscount: toNum(r[35]),
          shopComboDiscount: toNum(r[36]),
          shopeeCoinRebate: toNum(r[37]),
          cardDiscount: toNum(r[38]),
          tradeInDiscount: toNum(r[39]),
          tradeInBonus: toNum(r[40]),
          sellerTradeInBonus: toNum(r[42]),
          shippingFeeEst: toNum(r[41]),
          buyerShippingFee: toNum(r[43]),
          shopeeShippingSubsidy: toNum(r[44]),
          returnShippingFee: toNum(r[45]),
          totalBuyerPayment: toNum(r[46]),
          completedAt: toDate(r[47]),
          paidAt: toDate(r[48]),
          paymentMethod: toStr(r[49]),
          commissionFee: toNum(r[50]),
          serviceFee: toNum(r[51]),
          paymentFee: toNum(r[52]),
          deposit: toNum(r[53]),
          province: toStr(r[57]),
          district: toStr(r[58]),
          country: toStr(r[61]),
          items: [],
        };
        orderMap.set(orderId, order);
      }

      const order = orderMap.get(orderId)!;
      const returnRaw = toStr(r[15]);
      const returnStatus = returnRaw ? (RETURN_STATUS_MAP[returnRaw] || returnRaw.substring(0, 50)) : null;

      const item: ParsedOrderItem = {
        productSku: toStr(r[16]),
        productName: toStr(r[17]),
        variantSku: toStr(r[20]),
        variantName: toStr(r[21]),
        isBestseller: toBool(r[5]),
        weightKg: toNum(r[18]),
        originalPrice: toNum(r[22]),
        sellerDiscount: toNum(r[23]),
        platformDiscount: toNum(r[24]),
        totalSellerSubsidy: toNum(r[25]),
        dealPrice: toNum(r[26]),
        quantity: toNum(r[27]) || 1,
        returnQuantity: toNum(r[28]) || 0,
        buyerPaid: toNum(r[29]),
        returnStatus,
      };
      order.items.push(item);
    });

    return { orders: Array.from(orderMap.values()), totalRows };
  }
}
