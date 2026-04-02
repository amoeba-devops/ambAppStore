import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UploadHistoryService } from '../upload-history/upload-history.service';
import { ShopeeTrafficEntity } from './entity/shopee-traffic.entity';
import { TikTokTrafficEntity } from './entity/tiktok-traffic.entity';
import { ShopeeAdEntity } from './entity/shopee-ad.entity';
import { TikTokAdEntity } from './entity/tiktok-ad.entity';
import { TikTokAdLiveEntity } from './entity/tiktok-ad-live.entity';
import { ShopeeAffiliateEntity } from './entity/shopee-affiliate.entity';
import { ShopeeTrafficParserService } from './parser/shopee-traffic-parser.service';
import { TikTokTrafficParserService } from './parser/tiktok-traffic-parser.service';
import { ShopeeAdParserService } from './parser/shopee-ad-parser.service';
import { TikTokAdParserService } from './parser/tiktok-ad-parser.service';
import { TikTokAdLiveParserService } from './parser/tiktok-ad-live-parser.service';
import { ShopeeAffiliateParserService } from './parser/shopee-affiliate-parser.service';

@Injectable()
export class ReportUploadService {
  private readonly logger = new Logger(ReportUploadService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly uploadHistoryService: UploadHistoryService,
    @InjectRepository(ShopeeTrafficEntity)
    private readonly shopeeTrafficRepo: Repository<ShopeeTrafficEntity>,
    @InjectRepository(TikTokTrafficEntity)
    private readonly tiktokTrafficRepo: Repository<TikTokTrafficEntity>,
    @InjectRepository(ShopeeAdEntity)
    private readonly shopeeAdRepo: Repository<ShopeeAdEntity>,
    @InjectRepository(TikTokAdEntity)
    private readonly tiktokAdRepo: Repository<TikTokAdEntity>,
    @InjectRepository(TikTokAdLiveEntity)
    private readonly tiktokAdLiveRepo: Repository<TikTokAdLiveEntity>,
    @InjectRepository(ShopeeAffiliateEntity)
    private readonly shopeeAffiliateRepo: Repository<ShopeeAffiliateEntity>,
    private readonly shopeeTrafficParser: ShopeeTrafficParserService,
    private readonly tiktokTrafficParser: TikTokTrafficParserService,
    private readonly shopeeAdParser: ShopeeAdParserService,
    private readonly tiktokAdParser: TikTokAdParserService,
    private readonly tiktokAdLiveParser: TikTokAdLiveParserService,
    private readonly shopeeAffiliateParser: ShopeeAffiliateParserService,
  ) {}

  async uploadShopeeTraffic(entId: string, buffer: Buffer, meta: { fileName: string; fileSize: number; userId?: string; periodStart?: string; periodEnd?: string }) {
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'TRAFFIC_REPORT',
      channel: 'SHOPEE',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      createdBy: meta.userId,
    });

    try {
      const result = await this.shopeeTrafficParser.parse(buffer);
      const batchId = history.uphId;
      const entities = result.rows.map((row) =>
        this.shopeeTrafficRepo.create({
          entId,
          uphBatchId: batchId,
          stfProductId: row.productId,
          stfProductName: row.productName,
          stfProductStatus: row.productStatus,
          stfVariantId: row.variantId,
          stfVariantName: row.variantName,
          stfVariantSku: row.variantSku,
          stfProductSku: row.productSku,
          stfRevenuePlaced: row.revenuePlaced?.toString() ?? null,
          stfRevenueConfirmed: row.revenueConfirmed?.toString() ?? null,
          stfViews: row.views,
          stfClicks: row.clicks,
          stfCtr: row.ctr?.toString() ?? null,
          stfConvRatePlaced: row.convRatePlaced?.toString() ?? null,
          stfConvRateConfirmed: row.convRateConfirmed?.toString() ?? null,
          stfOrdersPlaced: row.ordersPlaced,
          stfOrdersConfirmed: row.ordersConfirmed,
          stfUnitsPlaced: row.unitsPlaced,
          stfUnitsConfirmed: row.unitsConfirmed,
          stfUniqueImpressions: row.uniqueImpressions,
          stfUniqueClicks: row.uniqueClicks,
          stfSearchClicks: row.searchClicks,
          stfAddToCartVisits: row.addToCartVisits,
          stfAddToCartUnits: row.addToCartUnits,
          stfCartConvRate: row.cartConvRate?.toString() ?? null,
          stfPeriodStart: meta.periodStart ? new Date(meta.periodStart) : null,
          stfPeriodEnd: meta.periodEnd ? new Date(meta.periodEnd) : null,
        }),
      );

      await this.bulkInsert(this.shopeeTrafficRepo, entities);
      await this.uploadHistoryService.complete(history.uphId, {
        rowCount: result.totalRows,
        successCount: entities.length,
        batchId,
      });

      return { totalRows: result.totalRows, inserted: entities.length, batchId };
    } catch (err) {
      await this.uploadHistoryService.fail(history.uphId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async uploadTikTokTraffic(entId: string, buffer: Buffer, meta: { fileName: string; fileSize: number; userId?: string }) {
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'TRAFFIC_REPORT',
      channel: 'TIKTOK',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      createdBy: meta.userId,
    });

    try {
      const result = await this.tiktokTrafficParser.parse(buffer);
      const batchId = history.uphId;
      const entities = result.rows.map((row) =>
        this.tiktokTrafficRepo.create({
          entId,
          uphBatchId: batchId,
          ttfProductId: row.productId,
          ttfProductName: row.productName,
          ttfStatus: row.status,
          ttfGmvTotal: row.gmvTotal?.toString() ?? null,
          ttfUnitsSold: row.unitsSold,
          ttfOrders: row.orders,
          ttfShopGmv: row.shopGmv?.toString() ?? null,
          ttfShopUnits: row.shopUnits,
          ttfShopImpressions: row.shopImpressions,
          ttfShopPageViews: row.shopPageViews,
          ttfShopUniqueViews: row.shopUniqueViews,
          ttfShopUniqueBuyers: row.shopUniqueBuyers,
          ttfShopCtr: row.shopCtr?.toString() ?? null,
          ttfShopConvRate: row.shopConvRate?.toString() ?? null,
          ttfLiveGmv: row.liveGmv?.toString() ?? null,
          ttfLiveUnits: row.liveUnits,
          ttfLiveImpressions: row.liveImpressions,
          ttfLivePageViews: row.livePageViews,
          ttfLiveUniqueViews: row.liveUniqueViews,
          ttfLiveUniqueBuyers: row.liveUniqueBuyers,
          ttfLiveCtr: row.liveCtr?.toString() ?? null,
          ttfLiveConvRate: row.liveConvRate?.toString() ?? null,
          ttfVideoGmv: row.videoGmv?.toString() ?? null,
          ttfVideoUnits: row.videoUnits,
          ttfVideoImpressions: row.videoImpressions,
          ttfVideoPageViews: row.videoPageViews,
          ttfVideoUniqueViews: row.videoUniqueViews,
          ttfVideoUniqueBuyers: row.videoUniqueBuyers,
          ttfVideoCtr: row.videoCtr?.toString() ?? null,
          ttfVideoConvRate: row.videoConvRate?.toString() ?? null,
          ttfCardGmv: row.cardGmv?.toString() ?? null,
          ttfCardUnits: row.cardUnits,
          ttfCardImpressions: row.cardImpressions,
          ttfCardPageViews: row.cardPageViews,
          ttfCardUniqueViews: row.cardUniqueViews,
          ttfCardUniqueBuyers: row.cardUniqueBuyers,
          ttfCardCtr: row.cardCtr?.toString() ?? null,
          ttfCardConvRate: row.cardConvRate?.toString() ?? null,
          ttfPeriodStart: result.periodStart ? new Date(result.periodStart) : null,
          ttfPeriodEnd: result.periodEnd ? new Date(result.periodEnd) : null,
        }),
      );

      await this.bulkInsert(this.tiktokTrafficRepo, entities);
      await this.uploadHistoryService.complete(history.uphId, {
        rowCount: result.totalRows,
        successCount: entities.length,
        batchId,
      });

      return { totalRows: result.totalRows, inserted: entities.length, batchId };
    } catch (err) {
      await this.uploadHistoryService.fail(history.uphId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async uploadShopeeAd(entId: string, buffer: Buffer, meta: { fileName: string; fileSize: number; userId?: string }) {
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'AD_REPORT',
      channel: 'SHOPEE',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      createdBy: meta.userId,
    });

    try {
      const result = await this.shopeeAdParser.parse(buffer);
      const batchId = history.uphId;
      const entities = result.rows.map((row) =>
        this.shopeeAdRepo.create({
          entId,
          uphBatchId: batchId,
          sadAdName: row.adName,
          sadStatus: row.status,
          sadAdType: row.adType,
          sadProductId: row.productId,
          sadBidMethod: row.bidMethod,
          sadPlacement: row.placement,
          sadStartDate: row.startDate,
          sadEndDate: row.endDate,
          sadImpressions: row.impressions,
          sadClicks: row.clicks,
          sadCtr: row.ctr?.toString() ?? null,
          sadConversions: row.conversions,
          sadDirectConversions: row.directConversions,
          sadConvRate: row.convRate?.toString() ?? null,
          sadDirectConvRate: row.directConvRate?.toString() ?? null,
          sadCostPerConversion: row.costPerConversion?.toString() ?? null,
          sadCostPerDirect: row.costPerDirect?.toString() ?? null,
          sadProductsSold: row.productsSold,
          sadDirectProductsSold: row.directProductsSold,
          sadTotalSales: row.totalSales?.toString() ?? null,
          sadDirectSales: row.directSales?.toString() ?? null,
          sadTotalCost: row.totalCost?.toString() ?? null,
          sadRoas: row.roas?.toString() ?? null,
          sadPeriodStart: result.periodStart ? new Date(result.periodStart) : null,
          sadPeriodEnd: result.periodEnd ? new Date(result.periodEnd) : null,
        }),
      );

      await this.bulkInsert(this.shopeeAdRepo, entities);
      await this.uploadHistoryService.complete(history.uphId, {
        rowCount: result.totalRows,
        successCount: entities.length,
        batchId,
      });

      return { totalRows: result.totalRows, inserted: entities.length, batchId };
    } catch (err) {
      await this.uploadHistoryService.fail(history.uphId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async uploadTikTokAd(entId: string, buffer: Buffer, meta: { fileName: string; fileSize: number; userId?: string; periodStart?: string; periodEnd?: string }) {
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'AD_REPORT',
      channel: 'TIKTOK',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      createdBy: meta.userId,
    });

    try {
      const result = await this.tiktokAdParser.parse(buffer);
      const batchId = history.uphId;
      const entities = result.rows.map((row) =>
        this.tiktokAdRepo.create({
          entId,
          uphBatchId: batchId,
          tadCampaignName: row.campaignName,
          tadCampaignId: row.campaignId,
          tadProductId: row.productId,
          tadCreativeType: row.creativeType,
          tadVideoTitle: row.videoTitle,
          tadVideoId: row.videoId,
          tadAccount: row.account,
          tadPostTime: row.postTime,
          tadStatus: row.status,
          tadAuthType: row.authType,
          tadCost: row.cost?.toString() ?? null,
          tadSkuOrders: row.skuOrders,
          tadCostPerOrder: row.costPerOrder?.toString() ?? null,
          tadGrossRevenue: row.grossRevenue?.toString() ?? null,
          tadRoi: row.roi?.toString() ?? null,
          tadImpressions: row.impressions,
          tadClicks: row.clicks,
          tadCtr: row.ctr?.toString() ?? null,
          tadConvRate: row.convRate?.toString() ?? null,
          tadView2sRate: row.view2sRate?.toString() ?? null,
          tadView6sRate: row.view6sRate?.toString() ?? null,
          tadView25Rate: row.view25Rate?.toString() ?? null,
          tadView50Rate: row.view50Rate?.toString() ?? null,
          tadView75Rate: row.view75Rate?.toString() ?? null,
          tadView100Rate: row.view100Rate?.toString() ?? null,
          tadCurrency: row.currency,
          tadPeriodStart: meta.periodStart ? new Date(meta.periodStart) : null,
          tadPeriodEnd: meta.periodEnd ? new Date(meta.periodEnd) : null,
        }),
      );

      await this.bulkInsert(this.tiktokAdRepo, entities);
      await this.uploadHistoryService.complete(history.uphId, {
        rowCount: result.totalRows,
        successCount: entities.length,
        batchId,
      });

      return { totalRows: result.totalRows, inserted: entities.length, batchId };
    } catch (err) {
      await this.uploadHistoryService.fail(history.uphId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async uploadTikTokAdLive(entId: string, buffer: Buffer, meta: { fileName: string; fileSize: number; userId?: string; periodStart?: string; periodEnd?: string }) {
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'AD_REPORT',
      channel: 'TIKTOK',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      createdBy: meta.userId,
    });

    try {
      const result = await this.tiktokAdLiveParser.parse(buffer);
      const batchId = history.uphId;
      const entities = result.rows.map((row) =>
        this.tiktokAdLiveRepo.create({
          entId,
          uphBatchId: batchId,
          talLiveName: row.liveName,
          talLaunchTime: row.launchTime,
          talStatus: row.status,
          talCampaignName: row.campaignName,
          talCampaignId: row.campaignId,
          talCost: row.cost?.toString() ?? null,
          talNetCost: row.netCost?.toString() ?? null,
          talSkuOrders: row.skuOrders,
          talSkuOrdersShop: row.skuOrdersShop,
          talCostPerOrder: row.costPerOrder?.toString() ?? null,
          talGrossRevenue: row.grossRevenue?.toString() ?? null,
          talGrossRevenueShop: row.grossRevenueShop?.toString() ?? null,
          talRoiShop: row.roiShop?.toString() ?? null,
          talLiveViews: row.liveViews,
          talCostPerView: row.costPerView?.toString() ?? null,
          talLiveViews10s: row.liveViews10s,
          talCostPer10sView: row.costPer10sView?.toString() ?? null,
          talLiveFollowers: row.liveFollowers,
          talCurrency: row.currency,
          talPeriodStart: meta.periodStart ? new Date(meta.periodStart) : null,
          talPeriodEnd: meta.periodEnd ? new Date(meta.periodEnd) : null,
        }),
      );

      await this.bulkInsert(this.tiktokAdLiveRepo, entities);
      await this.uploadHistoryService.complete(history.uphId, {
        rowCount: result.totalRows,
        successCount: entities.length,
        batchId,
      });

      return { totalRows: result.totalRows, inserted: entities.length, batchId };
    } catch (err) {
      await this.uploadHistoryService.fail(history.uphId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async uploadShopeeAffiliate(entId: string, buffer: Buffer, meta: { fileName: string; fileSize: number; userId?: string; periodStart?: string; periodEnd?: string }) {
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'AFFILIATE_REPORT',
      channel: 'SHOPEE',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      createdBy: meta.userId,
    });

    try {
      const result = await this.shopeeAffiliateParser.parse(buffer);
      const batchId = history.uphId;
      const entities = result.rows.map((row) =>
        this.shopeeAffiliateRepo.create({
          entId,
          uphBatchId: batchId,
          safOrderId: row.orderId,
          safStatus: row.status,
          safFraudStatus: row.fraudStatus,
          safOrderTime: row.orderTime,
          safProductId: row.productId,
          safProductName: row.productName,
          safModelId: row.modelId,
          safCategoryL1: row.categoryL1,
          safCategoryL2: row.categoryL2,
          safCategoryL3: row.categoryL3,
          safPrice: row.price?.toString() ?? null,
          safQuantity: row.quantity,
          safPartnerName: row.partnerName,
          safAffiliateAccount: row.affiliateAccount,
          safMcn: row.mcn,
          safCommissionRate: row.commissionRate?.toString() ?? null,
          safCommissionAmount: row.commissionAmount?.toString() ?? null,
          safSellerCommission: row.sellerCommission?.toString() ?? null,
          safPlatformCommission: row.platformCommission?.toString() ?? null,
          safTotalCost: row.totalCost?.toString() ?? null,
          safDeductionStatus: row.deductionStatus,
          safChannel: row.channel,
          safPeriodStart: meta.periodStart ? new Date(meta.periodStart) : null,
          safPeriodEnd: meta.periodEnd ? new Date(meta.periodEnd) : null,
        }),
      );

      await this.bulkInsert(this.shopeeAffiliateRepo, entities);
      await this.uploadHistoryService.complete(history.uphId, {
        rowCount: result.totalRows,
        successCount: entities.length,
        batchId,
      });

      return { totalRows: result.totalRows, inserted: entities.length, batchId };
    } catch (err) {
      await this.uploadHistoryService.fail(history.uphId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  private async bulkInsert<T extends object>(repo: Repository<T>, entities: T[]): Promise<void> {
    if (entities.length === 0) return;
    // Insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < entities.length; i += chunkSize) {
      const chunk = entities.slice(i, i + chunkSize);
      await repo.save(chunk as T[]);
    }
  }
}
