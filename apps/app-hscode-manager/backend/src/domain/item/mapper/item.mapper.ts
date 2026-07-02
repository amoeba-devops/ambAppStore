import { ItemEntity } from '../entity/item.entity';
import { ItemResponse } from '../dto/response/item.response';

export class ItemMapper {
  static toResponse(entity: ItemEntity): ItemResponse {
    return {
      id: entity.id,
      inquiryId: entity.inquiryId,
      nameRaw: entity.nameRaw,
      nameNormalized: entity.nameNormalized,
      category: entity.category,
      usageDescription: entity.usageDescription,
      compositionHash: entity.compositionHash,
      specAttributes: entity.specAttributes,
      gtin: entity.gtin,
      normalizerVersion: entity.normalizerVersion,
      completenessScore: entity.completenessScore
        ? Number(entity.completenessScore)
        : null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ItemEntity[]): ItemResponse[] {
    return entities.map((e) => ItemMapper.toResponse(e));
  }
}
