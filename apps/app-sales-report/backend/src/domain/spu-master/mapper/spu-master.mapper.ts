import { SpuMasterEntity } from '../entity/spu-master.entity';
import { SpuMasterResponse } from '../dto/response/spu-master.response';

export class SpuMasterMapper {
  static toResponse(entity: SpuMasterEntity): SpuMasterResponse {
    return {
      spuId: entity.spuId,
      spuCode: entity.spuCode,
      brandCode: entity.spuBrandCode,
      subBrand: entity.spuSubBrand,
      nameKr: entity.spuNameKr,
      nameEn: entity.spuNameEn,
      nameVi: entity.spuNameVi,
      categoryCode: entity.spuCategoryCode,
      categoryName: entity.spuCategoryName,
      isActive: entity.spuIsActive,
      createdAt: entity.spuCreatedAt.toISOString(),
      updatedAt: entity.spuUpdatedAt.toISOString(),
    };
  }

  static toListResponse(entities: SpuMasterEntity[]): SpuMasterResponse[] {
    return entities.map(SpuMasterMapper.toResponse);
  }
}
