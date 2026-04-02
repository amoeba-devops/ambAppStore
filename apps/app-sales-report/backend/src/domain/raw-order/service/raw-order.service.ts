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
}
