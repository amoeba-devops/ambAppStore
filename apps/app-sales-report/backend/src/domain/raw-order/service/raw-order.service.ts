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
import { UploadHistoryService } from '../../upload-history/upload-history.service';

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
    private readonly uploadHistoryService: UploadHistoryService,
  ) {}

  async uploadExcel(
    entId: string,
    channel: string,
    fileBuffer: Buffer,
    fileMeta?: { fileName: string; fileSize: number; userId?: string },
  ): Promise<UploadResultResponse> {
    // Create upload history record
    let historyId: string | null = null;
    if (fileMeta) {
      const history = await this.uploadHistoryService.create({
        entId,
        type: 'ORDER_REPORT',
        channel,
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        createdBy: fileMeta.userId,
      });
      historyId = history.uphId;
    }

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
      if (historyId) {
        await this.uploadHistoryService.fail(historyId, msg).catch(() => {});
      }
      throw new BusinessException(
        'DRD-E3002',
        `Failed to import orders: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }

    // Update upload history with results
    if (historyId) {
      await this.uploadHistoryService.complete(historyId, {
        rowCount: totalRows,
        successCount: ordersCreated,
        skipCount: ordersSkipped,
        errorCount: 0,
        batchId,
      }).catch(() => {});
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

  async findAll(
    entId: string,
    params: {
      startDate?: string;
      endDate?: string;
      channel?: string;
      status?: string;
      search?: string;
      page?: number;
      size?: number;
    },
  ) {
    const page = Math.max(1, params.page || 1);
    const size = Math.min(100, Math.max(1, params.size || 20));

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.ent_id = :entId', { entId });

    if (params.startDate) {
      qb.andWhere('DATE(o.ord_order_date) >= :start', { start: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('DATE(o.ord_order_date) <= :end', { end: params.endDate });
    }
    if (params.channel) {
      qb.andWhere('o.chn_code = :channel', { channel: params.channel.toUpperCase() });
    }
    if (params.status) {
      qb.andWhere('o.ord_status = :status', { status: params.status.toUpperCase() });
    }
    if (params.search) {
      qb.andWhere(
        '(o.ord_channel_order_id LIKE :search OR o.ord_tracking_no LIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    const [data, totalCount] = await qb
      .orderBy('o.ord_order_date', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    // Get item counts per order
    if (data.length > 0) {
      const orderIds = data.map((o) => o.ordId);
      const itemCounts = await this.itemRepo
        .createQueryBuilder('i')
        .select('i.ord_id', 'ordId')
        .addSelect('COUNT(*)', 'itemCount')
        .addSelect('SUM(i.oli_quantity)', 'totalQty')
        .addSelect(`SUM(CASE WHEN i.oli_sku_match_status = 'MATCHED' THEN 1 ELSE 0 END)`, 'matchedCount')
        .where('i.ord_id IN (:...orderIds)', { orderIds })
        .groupBy('i.ord_id')
        .getRawMany();

      const countMap = new Map(
        itemCounts.map((r) => [r.ordId, {
          itemCount: Number(r.itemCount),
          totalQty: Number(r.totalQty),
          matchedCount: Number(r.matchedCount),
        }]),
      );

      return {
        data: data.map((o) => {
          const counts = countMap.get(o.ordId);
          return {
            ordId: o.ordId,
            channelOrderId: o.ordChannelOrderId,
            channel: o.chnCode,
            orderDate: o.ordOrderDate,
            status: o.ordStatus,
            totalVnd: o.ordTotalVnd ? Number(o.ordTotalVnd) : 0,
            totalBuyerPayment: o.ordTotalBuyerPayment ? Number(o.ordTotalBuyerPayment) : 0,
            trackingNo: o.ordTrackingNo,
            itemCount: counts?.itemCount || 0,
            totalQty: counts?.totalQty || 0,
            skuMatchRate: counts
              ? counts.itemCount > 0
                ? Math.round((counts.matchedCount / counts.itemCount) * 100)
                : 0
              : 0,
          };
        }),
        pagination: {
          page,
          size,
          totalCount,
          totalPages: Math.ceil(totalCount / size),
        },
      };
    }

    return {
      data: [],
      pagination: { page, size, totalCount, totalPages: 0 },
    };
  }

  async findOne(entId: string, ordId: string) {
    const order = await this.orderRepo.findOne({
      where: { ordId, entId },
    });
    if (!order) {
      throw new BusinessException('DRD-E3020', 'Order not found', HttpStatus.NOT_FOUND);
    }

    const items = await this.itemRepo.find({
      where: { ordId },
      order: { oliCreatedAt: 'ASC' },
    });

    return {
      ...order,
      items: items.map((i) => ({
        oliId: i.oliId,
        productSku: i.oliProductSku,
        productName: i.oliProductName,
        variantSku: i.oliVariantSku,
        variantName: i.oliVariantName,
        quantity: i.oliQuantity,
        originalPrice: i.oliOriginalPrice ? Number(i.oliOriginalPrice) : null,
        dealPrice: i.oliDealPrice ? Number(i.oliDealPrice) : null,
        buyerPaid: i.oliBuyerPaid ? Number(i.oliBuyerPaid) : null,
        skuMatchStatus: i.oliSkuMatchStatus,
        returnStatus: i.oliReturnStatus,
        returnQuantity: i.oliReturnQuantity,
      })),
    };
  }

  async getDashboardSummary(entId: string) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const day30ago = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const day7ago = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    // 1. Overall KPI (last 30 days, completed orders only)
    const kpiRaw = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'COUNT(DISTINCT o.ord_id) AS totalOrders',
        `SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN 1 ELSE 0 END) AS completedOrders`,
        `COALESCE(SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN CAST(o.ord_total_vnd AS DECIMAL(15,2)) ELSE 0 END), 0) AS totalGmv`,
        `COALESCE(SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN CAST(o.ord_commission_fee AS DECIMAL(15,2)) ELSE 0 END), 0) AS totalCommission`,
        `COALESCE(SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN CAST(o.ord_service_fee AS DECIMAL(15,2)) ELSE 0 END), 0) AS totalServiceFee`,
      ])
      .where('o.ent_id = :entId', { entId })
      .andWhere('DATE(o.ord_order_date) >= :start', { start: day30ago })
      .andWhere('DATE(o.ord_order_date) <= :end', { end: today })
      .getRawOne();

    // 2. Channel breakdown (last 30 days)
    const channelBreakdown = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'o.chn_code AS channel',
        'COUNT(DISTINCT o.ord_id) AS orders',
        `COALESCE(SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN CAST(o.ord_total_vnd AS DECIMAL(15,2)) ELSE 0 END), 0) AS gmv`,
      ])
      .where('o.ent_id = :entId', { entId })
      .andWhere('DATE(o.ord_order_date) >= :start', { start: day30ago })
      .andWhere('DATE(o.ord_order_date) <= :end', { end: today })
      .groupBy('o.chn_code')
      .getRawMany();

    // 3. Daily GMV trend (last 7 days)
    const dailyTrend = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'DATE(o.ord_order_date) AS date',
        `COALESCE(SUM(CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN CAST(o.ord_total_vnd AS DECIMAL(15,2)) ELSE 0 END), 0) AS gmv`,
        `COUNT(DISTINCT CASE WHEN o.ord_status IN ('COMPLETED','SHIPPED','DELIVERED') THEN o.ord_id END) AS orders`,
      ])
      .where('o.ent_id = :entId', { entId })
      .andWhere('DATE(o.ord_order_date) >= :start', { start: day7ago })
      .andWhere('DATE(o.ord_order_date) <= :end', { end: today })
      .groupBy('DATE(o.ord_order_date)')
      .orderBy('DATE(o.ord_order_date)', 'ASC')
      .getRawMany();

    // 4. SKU match rate
    const skuStats = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(RawOrderEntity, 'o', 'o.ord_id = i.ord_id')
      .select([
        'COUNT(*) AS totalItems',
        `SUM(CASE WHEN i.oli_sku_match_status = 'MATCHED' THEN 1 ELSE 0 END) AS matchedItems`,
        `SUM(CASE WHEN i.oli_sku_match_status = 'UNMATCHED' THEN 1 ELSE 0 END) AS unmatchedItems`,
      ])
      .where('o.ent_id = :entId', { entId })
      .getRawOne();

    // 5. Recent uploads (last 5)
    const recentUploads = await this.orderRepo
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
      .limit(5)
      .getRawMany();

    const totalGmv = Number(kpiRaw?.totalGmv) || 0;
    const totalCommission = Number(kpiRaw?.totalCommission) || 0;
    const totalServiceFee = Number(kpiRaw?.totalServiceFee) || 0;
    const estimatedCm = totalGmv - totalCommission - totalServiceFee;

    const totalItems = Number(skuStats?.totalItems) || 0;
    const matchedItems = Number(skuStats?.matchedItems) || 0;

    return {
      kpi: {
        totalOrders: Number(kpiRaw?.totalOrders) || 0,
        completedOrders: Number(kpiRaw?.completedOrders) || 0,
        totalGmv,
        estimatedCm,
        cmPct: totalGmv > 0 ? (estimatedCm / totalGmv) * 100 : 0,
      },
      channelBreakdown: channelBreakdown.map((c) => ({
        channel: c.channel,
        orders: Number(c.orders) || 0,
        gmv: Number(c.gmv) || 0,
      })),
      dailyTrend: dailyTrend.map((d) => ({
        date: d.date,
        gmv: Number(d.gmv) || 0,
        orders: Number(d.orders) || 0,
      })),
      skuMatchRate: {
        totalItems,
        matchedItems,
        rate: totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0,
      },
      recentUploads: recentUploads.map((u) => ({
        channel: u.channel,
        batchId: u.batchId,
        orderCount: Number(u.orderCount) || 0,
        uploadedAt: u.uploadedAt,
      })),
      dateRange: { start: day30ago, end: today },
    };
  }
}
