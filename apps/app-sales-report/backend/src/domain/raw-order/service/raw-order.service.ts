import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RawOrderEntity } from '../entity/raw-order.entity';
import { RawOrderItemEntity } from '../entity/raw-order-item.entity';
import { SkuMasterEntity } from '../../sku-master/entity/sku-master.entity';
import { ShopeeExcelParser } from '../parser/shopee-excel.parser';
import { TikTokExcelParser } from '../parser/tiktok-excel.parser';
import { ParsedOrder } from '../parser/excel-parser.interface';
import { UploadResultResponse } from '../dto/response/upload-result.response';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class RawOrderService {
  constructor(
    @InjectRepository(RawOrderEntity)
    private readonly orderRepo: Repository<RawOrderEntity>,
    @InjectRepository(RawOrderItemEntity)
    private readonly itemRepo: Repository<RawOrderItemEntity>,
    @InjectRepository(SkuMasterEntity)
    private readonly skuRepo: Repository<SkuMasterEntity>,
    private readonly dataSource: DataSource,
    private readonly shopeeParser: ShopeeExcelParser,
    private readonly tikTokParser: TikTokExcelParser,
  ) {}

  async uploadExcel(
    entId: string,
    channel: string,
    fileBuffer: Buffer,
  ): Promise<UploadResultResponse> {
    // Select parser based on channel
    const parser = channel === 'SHOPEE' ? this.shopeeParser : this.tikTokParser;
    const { orders, totalRows } = await parser.parse(fileBuffer);

    if (orders.length === 0) {
      throw new BusinessException('DRD-E3001', 'No orders found in the uploaded file', HttpStatus.BAD_REQUEST);
    }

    // Build SKU map: wms_code → sku_id
    const skuEntities = await this.skuRepo.find({
      where: { entId },
      select: ['skuId', 'skuWmsCode'],
    });
    const skuMap = new Map<string, string>();
    for (const sku of skuEntities) {
      skuMap.set(sku.skuWmsCode, sku.skuId);
    }

    // Generate batch ID
    const batchId = `${channel.toLowerCase()}-upload-${Date.now()}`;

    let ordersCreated = 0;
    let ordersSkipped = 0;
    let itemsCreated = 0;
    const matchStats = { matched: 0, unmatched: 0, combo: 0 };

    // Process in transaction with chunks
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const parsed of orders) {
        // Check for duplicate
        const exists = await queryRunner.manager.findOne(RawOrderEntity, {
          where: {
            entId,
            chnCode: channel,
            ordChannelOrderId: parsed.channelOrderId,
          },
          select: ['ordId'],
        });

        if (exists) {
          ordersSkipped++;
          continue;
        }

        // Create order entity
        const orderEntity = queryRunner.manager.create(RawOrderEntity, {
          entId,
          chnCode: channel,
          ordChannelOrderId: parsed.channelOrderId,
          ordPackageId: parsed.packageId,
          ordOrderDate: parsed.orderDate,
          ordStatus: parsed.status,
          ordStatusRaw: parsed.statusRaw,
          ordCancelReason: parsed.cancelReason,
          ordTrackingNo: parsed.trackingNo,
          ordCarrier: parsed.carrier,
          ordDeliveryMethod: parsed.deliveryMethod,
          ordOrderType: parsed.orderType,
          ordEstDeliveryDate: parsed.estDeliveryDate,
          ordShipDate: parsed.shipDate,
          ordDeliveryTime: parsed.deliveryTime,
          ordTotalWeightKg: parsed.totalWeightKg?.toString() ?? null,
          ordTotalVnd: parsed.totalVnd?.toString() ?? null,
          ordShopVoucher: parsed.shopVoucher,
          ordCoinCashback: parsed.coinCashback?.toString() ?? null,
          ordShopeeVoucher: parsed.shopeeVoucher,
          ordPromoCombo: parsed.promoCombo,
          ordShopeeComboDiscount: parsed.shopeeComboDiscount?.toString() ?? null,
          ordShopComboDiscount: parsed.shopComboDiscount?.toString() ?? null,
          ordShopeeCoinRebate: parsed.shopeeCoinRebate?.toString() ?? null,
          ordCardDiscount: parsed.cardDiscount?.toString() ?? null,
          ordTradeInDiscount: parsed.tradeInDiscount?.toString() ?? null,
          ordTradeInBonus: parsed.tradeInBonus?.toString() ?? null,
          ordSellerTradeInBonus: parsed.sellerTradeInBonus?.toString() ?? null,
          ordShippingFeeEst: parsed.shippingFeeEst?.toString() ?? null,
          ordBuyerShippingFee: parsed.buyerShippingFee?.toString() ?? null,
          ordShopeeShippingSubsidy: parsed.shopeeShippingSubsidy?.toString() ?? null,
          ordReturnShippingFee: parsed.returnShippingFee?.toString() ?? null,
          ordTotalBuyerPayment: parsed.totalBuyerPayment?.toString() ?? null,
          ordCompletedAt: parsed.completedAt,
          ordPaidAt: parsed.paidAt,
          ordPaymentMethod: parsed.paymentMethod,
          ordCommissionFee: parsed.commissionFee?.toString() ?? null,
          ordServiceFee: parsed.serviceFee?.toString() ?? null,
          ordPaymentFee: parsed.paymentFee?.toString() ?? null,
          ordDeposit: parsed.deposit?.toString() ?? null,
          ordProvince: parsed.province,
          ordDistrict: parsed.district,
          ordCountry: parsed.country,
          ordImportBatchId: batchId,
        });

        const savedOrder = await queryRunner.manager.save(orderEntity);
        ordersCreated++;

        // Create item entities
        for (const parsedItem of parsed.items) {
          const variantSku = parsedItem.variantSku;
          let skuId: string | null = null;
          let skuMatchStatus = 'UNMATCHED';

          if (variantSku) {
            if (variantSku.startsWith('Combo') || variantSku.startsWith('COMBO') || variantSku.toUpperCase().includes('_GIFT_')) {
              skuMatchStatus = 'COMBO';
              matchStats.combo++;
            } else if (skuMap.has(variantSku)) {
              skuId = skuMap.get(variantSku)!;
              skuMatchStatus = 'MATCHED';
              matchStats.matched++;
            } else {
              matchStats.unmatched++;
            }
          } else {
            matchStats.unmatched++;
          }

          const itemEntity = queryRunner.manager.create(RawOrderItemEntity, {
            entId,
            ordId: savedOrder.ordId,
            skuId,
            oliProductSku: parsedItem.productSku,
            oliProductName: parsedItem.productName,
            oliVariantSku: parsedItem.variantSku,
            oliVariantName: parsedItem.variantName,
            oliIsBestseller: parsedItem.isBestseller ? 1 : 0,
            oliWeightKg: parsedItem.weightKg?.toString() ?? null,
            oliOriginalPrice: parsedItem.originalPrice?.toString() ?? null,
            oliSellerDiscount: parsedItem.sellerDiscount?.toString() ?? null,
            oliShopeeDiscount: parsedItem.platformDiscount?.toString() ?? null,
            oliTotalSellerSubsidy: parsedItem.totalSellerSubsidy?.toString() ?? null,
            oliDealPrice: parsedItem.dealPrice?.toString() ?? null,
            oliQuantity: parsedItem.quantity,
            oliReturnQuantity: parsedItem.returnQuantity,
            oliBuyerPaid: parsedItem.buyerPaid?.toString() ?? null,
            oliReturnStatus: parsedItem.returnStatus,
            oliSkuMatchStatus: skuMatchStatus,
          });

          await queryRunner.manager.save(itemEntity);
          itemsCreated++;
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new BusinessException(
        'DRD-E3002',
        `Failed to import orders: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }

    return {
      channel,
      ordersCreated,
      ordersSkipped,
      itemsCreated,
      matchStats,
      batchId,
    };
  }

  async getUploadHistory(entId: string) {
    const result = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'o.chn_code AS channel',
        'o.ord_import_batch_id AS batchId',
        'COUNT(DISTINCT o.ord_id) AS orderCount',
        'MIN(o.ord_created_at) AS uploadedAt',
      ])
      .where('o.ent_id = :entId', { entId })
      .andWhere('o.ord_import_batch_id IS NOT NULL')
      .groupBy('o.chn_code, o.ord_import_batch_id')
      .orderBy('MIN(o.ord_created_at)', 'DESC')
      .limit(50)
      .getRawMany();

    return result;
  }

  async getDailySummary(
    entId: string,
    startDate?: string,
    endDate?: string,
    channel?: string,
  ) {
    // Default: last 30 days
    const end = endDate || new Date().toISOString().slice(0, 10);
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select([
        'DATE(o.ord_order_date) AS date',
        'o.chn_code AS channel',
        'COUNT(DISTINCT o.ord_id) AS orderCount',
        `SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN 1 ELSE 0 END) AS completedCount`,
        `SUM(CASE WHEN o.ord_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelledCount`,
        'COALESCE(SUM(CAST(o.ord_total_vnd AS DECIMAL(15,2))), 0) AS totalGmv',
        'COALESCE(SUM(CAST(o.ord_total_buyer_payment AS DECIMAL(15,2))), 0) AS totalBuyerPayment',
        'COALESCE(SUM(CAST(o.ord_commission_fee AS DECIMAL(15,2))), 0) AS totalCommission',
        'COALESCE(SUM(CAST(o.ord_service_fee AS DECIMAL(15,2))), 0) AS totalServiceFee',
        'COALESCE(SUM(CAST(o.ord_shipping_fee_est AS DECIMAL(15,2))), 0) AS totalShippingFee',
      ])
      .where('o.ent_id = :entId', { entId })
      .andWhere('DATE(o.ord_order_date) >= :start', { start })
      .andWhere('DATE(o.ord_order_date) <= :end', { end });

    if (channel) {
      qb.andWhere('o.chn_code = :channel', { channel: channel.toUpperCase() });
    }

    const daily = await qb
      .groupBy('DATE(o.ord_order_date), o.chn_code')
      .orderBy('DATE(o.ord_order_date)', 'DESC')
      .addOrderBy('o.chn_code', 'ASC')
      .getRawMany();

    // Also get item-level aggregation
    const itemQb = this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(RawOrderEntity, 'o', 'o.ord_id = i.ord_id')
      .select([
        'DATE(o.ord_order_date) AS date',
        'o.chn_code AS channel',
        'SUM(i.oli_quantity) AS totalQuantity',
        'COUNT(DISTINCT i.oli_variant_sku) AS uniqueSkuCount',
      ])
      .where('o.ent_id = :entId', { entId })
      .andWhere('DATE(o.ord_order_date) >= :start', { start })
      .andWhere('DATE(o.ord_order_date) <= :end', { end });

    if (channel) {
      itemQb.andWhere('o.chn_code = :channel', { channel: channel.toUpperCase() });
    }

    const itemAgg = await itemQb
      .groupBy('DATE(o.ord_order_date), o.chn_code')
      .getRawMany();

    // Merge item data into daily
    const itemMap = new Map<string, { totalQuantity: number; uniqueSkuCount: number }>();
    for (const row of itemAgg) {
      itemMap.set(`${row.date}|${row.channel}`, {
        totalQuantity: Number(row.totalQuantity) || 0,
        uniqueSkuCount: Number(row.uniqueSkuCount) || 0,
      });
    }

    const rows = daily.map((row) => {
      const key = `${row.date}|${row.channel}`;
      const items = itemMap.get(key);
      return {
        date: row.date,
        channel: row.channel,
        orderCount: Number(row.orderCount) || 0,
        completedCount: Number(row.completedCount) || 0,
        cancelledCount: Number(row.cancelledCount) || 0,
        totalGmv: Number(row.totalGmv) || 0,
        totalBuyerPayment: Number(row.totalBuyerPayment) || 0,
        totalCommission: Number(row.totalCommission) || 0,
        totalServiceFee: Number(row.totalServiceFee) || 0,
        totalShippingFee: Number(row.totalShippingFee) || 0,
        totalQuantity: items?.totalQuantity || 0,
        uniqueSkuCount: items?.uniqueSkuCount || 0,
      };
    });

    // Summary totals
    const summary = {
      totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
      totalCompleted: rows.reduce((s, r) => s + r.completedCount, 0),
      totalCancelled: rows.reduce((s, r) => s + r.cancelledCount, 0),
      totalGmv: rows.reduce((s, r) => s + r.totalGmv, 0),
      totalQuantity: rows.reduce((s, r) => s + r.totalQuantity, 0),
    };

    return { rows, summary, dateRange: { start, end } };
  }
}
