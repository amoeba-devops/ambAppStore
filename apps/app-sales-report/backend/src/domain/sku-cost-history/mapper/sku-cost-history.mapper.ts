import { SkuCostHistoryEntity } from '../entity/sku-cost-history.entity';
import { SkuCostHistoryResponse } from '../dto/response/sku-cost-history.response';

export class SkuCostHistoryMapper {
  static toResponse(entity: SkuCostHistoryEntity): SkuCostHistoryResponse {
    return {
      schId: entity.schId,
      skuId: entity.skuId,
      primeCost: Number(entity.schPrimeCost),
      supplyPrice: Number(entity.schSupplyPrice),
      listingPrice: Number(entity.schListingPrice),
      sellingPrice: Number(entity.schSellingPrice),
      effectiveDate: String(entity.schEffectiveDate),
      memo: entity.schMemo,
      createdBy: entity.schCreatedBy,
      createdAt: entity.schCreatedAt.toISOString(),
    };
  }

  static toListResponse(entities: SkuCostHistoryEntity[]): SkuCostHistoryResponse[] {
    return entities.map(SkuCostHistoryMapper.toResponse);
  }
}
