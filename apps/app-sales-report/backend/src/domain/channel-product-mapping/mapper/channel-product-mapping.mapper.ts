import { ChannelProductMappingEntity } from '../entity/channel-product-mapping.entity';
import { ChannelProductMappingResponse } from '../dto/response/channel-product-mapping.response';

export class ChannelProductMappingMapper {
  static toResponse(entity: ChannelProductMappingEntity): ChannelProductMappingResponse {
    return {
      cpmId: entity.cpmId,
      skuId: entity.skuId,
      wmsCode: entity.sku?.skuWmsCode || '',
      skuNameKr: entity.sku?.skuNameKr || '',
      chnCode: entity.chnCode,
      channelProductId: entity.cpmChannelProductId,
      channelVariationId: entity.cpmChannelVariationId,
      channelNameVi: entity.cpmChannelNameVi,
      listingPrice: entity.cpmListingPrice ? Number(entity.cpmListingPrice) : null,
      sellingPrice: entity.cpmSellingPrice ? Number(entity.cpmSellingPrice) : null,
      isActive: entity.cpmIsActive,
      createdAt: entity.cpmCreatedAt.toISOString(),
      updatedAt: entity.cpmUpdatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ChannelProductMappingEntity[]): ChannelProductMappingResponse[] {
    return entities.map(ChannelProductMappingMapper.toResponse);
  }
}
