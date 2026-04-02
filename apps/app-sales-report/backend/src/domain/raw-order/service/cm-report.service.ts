import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawOrderEntity } from '../entity/raw-order.entity';
import { RawOrderItemEntity } from '../entity/raw-order-item.entity';
import { SkuMasterEntity } from '../../sku-master/entity/sku-master.entity';
import { ChannelMasterEntity } from '../../channel-master/entity/channel-master.entity';

export interface ProductCmRow {
  productName: string;
  productNameEn: string;
  variantSku: string;
  skuWmsCode: string | null;
  channel: string;
  itemsSold: number;
  gmv: number;
  sellerDiscount: number;
  nmv: number;
  primeCost: number;
  primeCostTotal: number;
  fulfillmentFee: number;
  platformFee: number;
  adSpend: number;
  commissionFee: number;
  serviceFee: number;
  cm: number;
  cmPct: number;
  cmStatus: string;
}

export interface WeeklySummary {
  year: number;
  weekNo: number;
  startDate: string;
  endDate: string;
  channel: string;
  orders: number;
  itemsSold: number;
  gmv: number;
  sellerDiscount: number;
  nmv: number;
  primeCostTotal: number;
  fulfillmentFee: number;
  platformFee: number;
  commissionFee: number;
  serviceFee: number;
  shippingFee: number;
  cm: number;
  cmPct: number;
  products: ProductCmRow[];
}

export interface MonthlySummary {
  year: number;
  month: number;
  channel: string;
  orders: number;
  itemsSold: number;
  gmv: number;
  sellerDiscount: number;
  nmv: number;
  primeCostTotal: number;
  fulfillmentFee: number;
  platformFee: number;
  commissionFee: number;
  serviceFee: number;
  shippingFee: number;
  cm: number;
  cmPct: number;
  // MoM comparison
  prevGmv: number | null;
  prevCm: number | null;
  prevCmPct: number | null;
  gmvMomRate: number | null;
  cmMomRate: number | null;
  products: ProductCmRow[];
}

const DEFAULT_FULFILLMENT_FEE = 14000;

@Injectable()
export class CmReportService {
  constructor(
    @InjectRepository(RawOrderEntity)
    private readonly orderRepo: Repository<RawOrderEntity>,
    @InjectRepository(RawOrderItemEntity)
    private readonly itemRepo: Repository<RawOrderItemEntity>,
    @InjectRepository(SkuMasterEntity)
    private readonly skuRepo: Repository<SkuMasterEntity>,
    @InjectRepository(ChannelMasterEntity)
    private readonly channelRepo: Repository<ChannelMasterEntity>,
  ) {}

  /**
   * Get weekly CM report.
   * Aggregates raw orders by ISO week, calculates CM per product.
   */
  async getWeeklySummary(
    entId: string,
    year?: number,
    weekNo?: number,
    channel?: string,
  ): Promise<{ weeks: WeeklySummary[] }> {
    const targetYear = year || new Date().getFullYear();

    // Build date range for the specific week or all weeks
    let dateFilter = '';
    const params: Record<string, unknown> = { entId, targetYear };

    if (weekNo) {
      dateFilter = 'AND YEARWEEK(o.ord_order_date, 1) = :yearWeek';
      // YEARWEEK with mode 1 = ISO week (Monday start)
      params.yearWeek = targetYear * 100 + weekNo;
    }

    if (channel) {
      dateFilter += ' AND o.chn_code = :channel';
      params.channel = channel.toUpperCase();
    }

    // Get channel fee rates
    const channelMasters = await this.channelRepo.find();
    const channelFeeMap = new Map<string, { platformFeeRate: number; fulfillmentFee: number }>();
    for (const ch of channelMasters) {
      channelFeeMap.set(ch.chnCode, {
        platformFeeRate: Number(ch.chnDefaultPlatformFeeRate) || 0,
        fulfillmentFee: Number(ch.chnDefaultFulfillmentFee) || DEFAULT_FULFILLMENT_FEE,
      });
    }

    // Get SKU prime costs + fulfillment overrides
    const skuEntities = await this.skuRepo.find({
      where: { entId },
      select: ['skuId', 'skuWmsCode', 'skuPrimeCost', 'skuFulfillmentFeeOverride'],
    });
    const skuCostMap = new Map<string, { primeCost: number; fulfillmentOverride: number | null }>();
    for (const sku of skuEntities) {
      skuCostMap.set(sku.skuId, {
        primeCost: Number(sku.skuPrimeCost) || 0,
        fulfillmentOverride: sku.skuFulfillmentFeeOverride != null ? Number(sku.skuFulfillmentFeeOverride) : null,
      });
    }

    // Get weekly order-level aggregation
    const weeklyOrders = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'YEAR(o.ord_order_date) AS yr',
        'WEEKOFYEAR(o.ord_order_date) AS wk',
        'o.chn_code AS channel',
        'MIN(DATE(o.ord_order_date)) AS startDate',
        'MAX(DATE(o.ord_order_date)) AS endDate',
        'COUNT(DISTINCT o.ord_id) AS orderCount',
        'COALESCE(SUM(CAST(o.ord_total_vnd AS DECIMAL(18,2))), 0) AS gmv',
        'COALESCE(SUM(CAST(o.ord_total_buyer_payment AS DECIMAL(18,2))), 0) AS totalBuyerPayment',
        'COALESCE(SUM(CAST(o.ord_commission_fee AS DECIMAL(18,2))), 0) AS commissionFee',
        'COALESCE(SUM(CAST(o.ord_service_fee AS DECIMAL(18,2))), 0) AS serviceFee',
        'COALESCE(SUM(CAST(o.ord_shipping_fee_est AS DECIMAL(18,2))), 0) AS shippingFee',
      ])
      .where(`o.ent_id = :entId AND YEAR(o.ord_order_date) = :targetYear AND o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') ${dateFilter}`)
      .setParameters(params)
      .groupBy('YEAR(o.ord_order_date), WEEKOFYEAR(o.ord_order_date), o.chn_code')
      .orderBy('YEAR(o.ord_order_date)', 'DESC')
      .addOrderBy('WEEKOFYEAR(o.ord_order_date)', 'DESC')
      .getRawMany();

    // Get item-level aggregation per week per product
    const weeklyItems = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(RawOrderEntity, 'o', 'o.ord_id = i.ord_id')
      .select([
        'YEAR(o.ord_order_date) AS yr',
        'WEEKOFYEAR(o.ord_order_date) AS wk',
        'o.chn_code AS channel',
        'COALESCE(i.oli_product_name, "Unknown") AS productName',
        'i.oli_variant_sku AS variantSku',
        'i.sku_id AS skuId',
        'SUM(i.oli_quantity) AS itemsSold',
        'COALESCE(SUM(CAST(i.oli_deal_price AS DECIMAL(18,2)) * i.oli_quantity), 0) AS itemGmv',
        'COALESCE(SUM(CAST(i.oli_seller_discount AS DECIMAL(18,2))), 0) AS sellerDiscount',
        'COALESCE(SUM(CAST(i.oli_buyer_paid AS DECIMAL(18,2))), 0) AS buyerPaid',
      ])
      .where(`o.ent_id = :entId AND YEAR(o.ord_order_date) = :targetYear AND o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') ${dateFilter}`)
      .setParameters(params)
      .groupBy('YEAR(o.ord_order_date), WEEKOFYEAR(o.ord_order_date), o.chn_code, i.oli_product_name, i.oli_variant_sku, i.sku_id')
      .orderBy('SUM(CAST(i.oli_buyer_paid AS DECIMAL(18,2)))', 'DESC')
      .getRawMany();

    // Build result per week
    const weekMap = new Map<string, WeeklySummary>();

    for (const row of weeklyOrders) {
      const key = `${row.yr}-${row.wk}-${row.channel}`;
      weekMap.set(key, {
        year: Number(row.yr),
        weekNo: Number(row.wk),
        startDate: row.startDate,
        endDate: row.endDate,
        channel: row.channel,
        orders: Number(row.orderCount),
        itemsSold: 0,
        gmv: Number(row.gmv),
        sellerDiscount: 0,
        nmv: 0,
        primeCostTotal: 0,
        fulfillmentFee: 0,
        platformFee: 0,
        commissionFee: Number(row.commissionFee),
        serviceFee: Number(row.serviceFee),
        shippingFee: Number(row.shippingFee),
        cm: 0,
        cmPct: 0,
        products: [],
      });
    }

    // Populate product-level CM
    for (const item of weeklyItems) {
      const key = `${item.yr}-${item.wk}-${item.channel}`;
      const week = weekMap.get(key);
      if (!week) continue;

      const itemsSold = Number(item.itemsSold) || 0;
      const itemGmv = Number(item.itemGmv) || 0;
      const sellerDiscount = Number(item.sellerDiscount) || 0;
      const buyerPaid = Number(item.buyerPaid) || 0;
      const nmv = buyerPaid || (itemGmv - sellerDiscount);

      // Prime cost from SKU master
      const skuData = item.skuId ? skuCostMap.get(item.skuId) : null;
      const primeCostUnit = skuData?.primeCost || 0;
      const primeCostTotal = primeCostUnit * itemsSold;

      // Fulfillment fee
      const channelFee = channelFeeMap.get(item.channel);
      const fulfillmentUnit = skuData?.fulfillmentOverride ?? channelFee?.fulfillmentFee ?? DEFAULT_FULFILLMENT_FEE;
      const fulfillmentTotal = fulfillmentUnit * itemsSold;

      // Platform fee
      const platformFeeRate = channelFee?.platformFeeRate || 0;
      const platformFee = nmv * platformFeeRate;

      // CM = GMV - primeCost - fulfillment - platformFee - sellerDiscount
      const cm = itemGmv - primeCostTotal - fulfillmentTotal - platformFee - sellerDiscount;
      const cmPct = itemGmv > 0 ? (cm / itemGmv) * 100 : 0;

      let cmStatus = 'NORMAL';
      if (!skuData) cmStatus = item.skuId ? 'PRIME_COST_MISSING' : 'SKU_UNMAPPED';
      else if (primeCostUnit === 0) cmStatus = 'PRIME_COST_MISSING';
      else if (cm < 0) cmStatus = 'NEGATIVE';

      const product: ProductCmRow = {
        productName: item.productName,
        productNameEn: '',
        variantSku: item.variantSku || '',
        skuWmsCode: item.variantSku || null,
        channel: item.channel,
        itemsSold,
        gmv: itemGmv,
        sellerDiscount,
        nmv,
        primeCost: primeCostUnit,
        primeCostTotal,
        fulfillmentFee: fulfillmentTotal,
        platformFee,
        adSpend: 0,
        commissionFee: 0,
        serviceFee: 0,
        cm,
        cmPct,
        cmStatus,
      };

      week.products.push(product);
      week.itemsSold += itemsSold;
      week.sellerDiscount += sellerDiscount;
      week.nmv += nmv;
      week.primeCostTotal += primeCostTotal;
      week.fulfillmentFee += fulfillmentTotal;
      week.platformFee += platformFee;
    }

    // Calculate week-level CM
    for (const week of weekMap.values()) {
      week.cm = week.gmv - week.primeCostTotal - week.fulfillmentFee - week.platformFee
        - week.sellerDiscount - week.commissionFee - week.serviceFee;
      week.cmPct = week.gmv > 0 ? (week.cm / week.gmv) * 100 : 0;
    }

    const weeks = Array.from(weekMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.weekNo !== b.weekNo) return b.weekNo - a.weekNo;
      return a.channel.localeCompare(b.channel);
    });

    return { weeks };
  }

  /**
   * Get monthly CM report with MoM comparison.
   */
  async getMonthlySummary(
    entId: string,
    year?: number,
    month?: number,
    channel?: string,
  ): Promise<{ months: MonthlySummary[] }> {
    const targetYear = year || new Date().getFullYear();

    let dateFilter = '';
    const params: Record<string, unknown> = { entId, targetYear };

    if (month) {
      dateFilter = 'AND MONTH(o.ord_order_date) = :month';
      params.month = month;
    }
    if (channel) {
      dateFilter += ' AND o.chn_code = :channel';
      params.channel = channel.toUpperCase();
    }

    // Channel fees
    const channelMasters = await this.channelRepo.find();
    const channelFeeMap = new Map<string, { platformFeeRate: number; fulfillmentFee: number }>();
    for (const ch of channelMasters) {
      channelFeeMap.set(ch.chnCode, {
        platformFeeRate: Number(ch.chnDefaultPlatformFeeRate) || 0,
        fulfillmentFee: Number(ch.chnDefaultFulfillmentFee) || DEFAULT_FULFILLMENT_FEE,
      });
    }

    // SKU costs
    const skuEntities = await this.skuRepo.find({
      where: { entId },
      select: ['skuId', 'skuWmsCode', 'skuPrimeCost', 'skuFulfillmentFeeOverride'],
    });
    const skuCostMap = new Map<string, { primeCost: number; fulfillmentOverride: number | null }>();
    for (const sku of skuEntities) {
      skuCostMap.set(sku.skuId, {
        primeCost: Number(sku.skuPrimeCost) || 0,
        fulfillmentOverride: sku.skuFulfillmentFeeOverride != null ? Number(sku.skuFulfillmentFeeOverride) : null,
      });
    }

    // Monthly order-level aggregation
    const monthlyOrders = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'YEAR(o.ord_order_date) AS yr',
        'MONTH(o.ord_order_date) AS mo',
        'o.chn_code AS channel',
        'COUNT(DISTINCT o.ord_id) AS orderCount',
        'COALESCE(SUM(CAST(o.ord_total_vnd AS DECIMAL(18,2))), 0) AS gmv',
        'COALESCE(SUM(CAST(o.ord_total_buyer_payment AS DECIMAL(18,2))), 0) AS totalBuyerPayment',
        'COALESCE(SUM(CAST(o.ord_commission_fee AS DECIMAL(18,2))), 0) AS commissionFee',
        'COALESCE(SUM(CAST(o.ord_service_fee AS DECIMAL(18,2))), 0) AS serviceFee',
        'COALESCE(SUM(CAST(o.ord_shipping_fee_est AS DECIMAL(18,2))), 0) AS shippingFee',
      ])
      .where(`o.ent_id = :entId AND YEAR(o.ord_order_date) = :targetYear AND o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') ${dateFilter}`)
      .setParameters(params)
      .groupBy('YEAR(o.ord_order_date), MONTH(o.ord_order_date), o.chn_code')
      .orderBy('MONTH(o.ord_order_date)', 'DESC')
      .getRawMany();

    // Also fetch previous year data for MoM (if specific month requested, fetch prev month)
    const prevParams: Record<string, unknown> = { entId };
    let prevDateFilter = `o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED')`;

    if (month) {
      // Previous month
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? targetYear - 1 : targetYear;
      prevDateFilter += ` AND YEAR(o.ord_order_date) = :prevYear AND MONTH(o.ord_order_date) = :prevMonth`;
      prevParams.prevYear = prevYear;
      prevParams.prevMonth = prevMonth;
    } else {
      // All months of previous year (for full MoM)
      prevDateFilter += ` AND YEAR(o.ord_order_date) = :prevYear`;
      prevParams.prevYear = targetYear - 1;
    }
    if (channel) {
      prevDateFilter += ' AND o.chn_code = :channel';
      prevParams.channel = channel.toUpperCase();
    }

    const prevMonthlyOrders = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'YEAR(o.ord_order_date) AS yr',
        'MONTH(o.ord_order_date) AS mo',
        'o.chn_code AS channel',
        'COALESCE(SUM(CAST(o.ord_total_vnd AS DECIMAL(18,2))), 0) AS gmv',
      ])
      .where(`o.ent_id = :entId AND ${prevDateFilter}`)
      .setParameters(prevParams)
      .groupBy('YEAR(o.ord_order_date), MONTH(o.ord_order_date), o.chn_code')
      .getRawMany();

    const prevGmvMap = new Map<string, number>();
    for (const row of prevMonthlyOrders) {
      prevGmvMap.set(`${row.yr}-${row.mo}-${row.channel}`, Number(row.gmv));
    }

    // Item-level aggregation per month per product
    const monthlyItems = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(RawOrderEntity, 'o', 'o.ord_id = i.ord_id')
      .select([
        'YEAR(o.ord_order_date) AS yr',
        'MONTH(o.ord_order_date) AS mo',
        'o.chn_code AS channel',
        'COALESCE(i.oli_product_name, "Unknown") AS productName',
        'i.oli_variant_sku AS variantSku',
        'i.sku_id AS skuId',
        'SUM(i.oli_quantity) AS itemsSold',
        'COALESCE(SUM(CAST(i.oli_deal_price AS DECIMAL(18,2)) * i.oli_quantity), 0) AS itemGmv',
        'COALESCE(SUM(CAST(i.oli_seller_discount AS DECIMAL(18,2))), 0) AS sellerDiscount',
        'COALESCE(SUM(CAST(i.oli_buyer_paid AS DECIMAL(18,2))), 0) AS buyerPaid',
      ])
      .where(`o.ent_id = :entId AND YEAR(o.ord_order_date) = :targetYear AND o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') ${dateFilter}`)
      .setParameters(params)
      .groupBy('YEAR(o.ord_order_date), MONTH(o.ord_order_date), o.chn_code, i.oli_product_name, i.oli_variant_sku, i.sku_id')
      .orderBy('SUM(CAST(i.oli_buyer_paid AS DECIMAL(18,2)))', 'DESC')
      .getRawMany();

    // Build monthly summaries
    const monthMap = new Map<string, MonthlySummary>();

    for (const row of monthlyOrders) {
      const key = `${row.yr}-${row.mo}-${row.channel}`;
      monthMap.set(key, {
        year: Number(row.yr),
        month: Number(row.mo),
        channel: row.channel,
        orders: Number(row.orderCount),
        itemsSold: 0,
        gmv: Number(row.gmv),
        sellerDiscount: 0,
        nmv: 0,
        primeCostTotal: 0,
        fulfillmentFee: 0,
        platformFee: 0,
        commissionFee: Number(row.commissionFee),
        serviceFee: Number(row.serviceFee),
        shippingFee: Number(row.shippingFee),
        cm: 0,
        cmPct: 0,
        prevGmv: null,
        prevCm: null,
        prevCmPct: null,
        gmvMomRate: null,
        cmMomRate: null,
        products: [],
      });
    }

    // Product-level CM
    for (const item of monthlyItems) {
      const key = `${item.yr}-${item.mo}-${item.channel}`;
      const mo = monthMap.get(key);
      if (!mo) continue;

      const itemsSold = Number(item.itemsSold) || 0;
      const itemGmv = Number(item.itemGmv) || 0;
      const sellerDiscount = Number(item.sellerDiscount) || 0;
      const buyerPaid = Number(item.buyerPaid) || 0;
      const nmv = buyerPaid || (itemGmv - sellerDiscount);

      const skuData = item.skuId ? skuCostMap.get(item.skuId) : null;
      const primeCostUnit = skuData?.primeCost || 0;
      const primeCostTotal = primeCostUnit * itemsSold;

      const channelFee = channelFeeMap.get(item.channel);
      const fulfillmentUnit = skuData?.fulfillmentOverride ?? channelFee?.fulfillmentFee ?? DEFAULT_FULFILLMENT_FEE;
      const fulfillmentTotal = fulfillmentUnit * itemsSold;

      const platformFeeRate = channelFee?.platformFeeRate || 0;
      const platformFee = nmv * platformFeeRate;

      const cm = itemGmv - primeCostTotal - fulfillmentTotal - platformFee - sellerDiscount;
      const cmPct = itemGmv > 0 ? (cm / itemGmv) * 100 : 0;

      let cmStatus = 'NORMAL';
      if (!skuData) cmStatus = item.skuId ? 'PRIME_COST_MISSING' : 'SKU_UNMAPPED';
      else if (primeCostUnit === 0) cmStatus = 'PRIME_COST_MISSING';
      else if (cm < 0) cmStatus = 'NEGATIVE';

      mo.products.push({
        productName: item.productName,
        productNameEn: '',
        variantSku: item.variantSku || '',
        skuWmsCode: item.variantSku || null,
        channel: item.channel,
        itemsSold,
        gmv: itemGmv,
        sellerDiscount,
        nmv,
        primeCost: primeCostUnit,
        primeCostTotal,
        fulfillmentFee: fulfillmentTotal,
        platformFee,
        adSpend: 0,
        commissionFee: 0,
        serviceFee: 0,
        cm,
        cmPct,
        cmStatus,
      });

      mo.itemsSold += itemsSold;
      mo.sellerDiscount += sellerDiscount;
      mo.nmv += nmv;
      mo.primeCostTotal += primeCostTotal;
      mo.fulfillmentFee += fulfillmentTotal;
      mo.platformFee += platformFee;
    }

    // Month-level CM + MoM
    for (const mo of monthMap.values()) {
      mo.cm = mo.gmv - mo.primeCostTotal - mo.fulfillmentFee - mo.platformFee
        - mo.sellerDiscount - mo.commissionFee - mo.serviceFee;
      mo.cmPct = mo.gmv > 0 ? (mo.cm / mo.gmv) * 100 : 0;

      // MoM: find previous month data
      const prevMonth = mo.month === 1 ? 12 : mo.month - 1;
      const prevYear = mo.month === 1 ? mo.year - 1 : mo.year;
      const prevKey = `${prevYear}-${prevMonth}-${mo.channel}`;
      const prevGmv = prevGmvMap.get(prevKey);
      if (prevGmv != null && prevGmv > 0) {
        mo.prevGmv = prevGmv;
        mo.gmvMomRate = ((mo.gmv - prevGmv) / prevGmv) * 100;
      }
    }

    const months = Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return a.channel.localeCompare(b.channel);
    });

    return { months };
  }
}
