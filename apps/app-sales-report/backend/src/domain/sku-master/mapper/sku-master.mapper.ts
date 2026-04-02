import { SkuMasterEntity } from '../entity/sku-master.entity';
import { SkuMasterResponse } from '../dto/response/sku-master.response';

export class SkuMasterMapper {
  static toResponse(entity: SkuMasterEntity): SkuMasterResponse {
    return {
      skuId: entity.skuId,
      spuId: entity.spuId,
      spuCode: entity.skuSpuCode,
      wmsCode: entity.skuWmsCode,
      nameKr: entity.skuNameKr,
      nameEn: entity.skuNameEn,
      nameVi: entity.skuNameVi,
      variantType: entity.skuVariantType,
      variantValue: entity.skuVariantValue,
      syncCode: entity.skuSyncCode,
      gtinCode: entity.skuGtinCode,
      hsCode: entity.skuHsCode,
      primeCost: Number(entity.skuPrimeCost),
      supplyPrice: entity.skuSupplyPrice ? Number(entity.skuSupplyPrice) : null,
      listingPrice: entity.skuListingPrice ? Number(entity.skuListingPrice) : null,
      sellingPrice: entity.skuSellingPrice ? Number(entity.skuSellingPrice) : null,
      fulfillmentFeeOverride: entity.skuFulfillmentFeeOverride ? Number(entity.skuFulfillmentFeeOverride) : null,
      weightGram: entity.skuWeightGram,
      unit: entity.skuUnit,
      isActive: entity.skuIsActive,
      costUpdatedAt: entity.skuCostUpdatedAt?.toISOString() || null,
      createdAt: entity.skuCreatedAt.toISOString(),
      updatedAt: entity.skuUpdatedAt.toISOString(),
    };
  }

  static toListResponse(entities: SkuMasterEntity[]): SkuMasterResponse[] {
    return entities.map(SkuMasterMapper.toResponse);
  }
}
