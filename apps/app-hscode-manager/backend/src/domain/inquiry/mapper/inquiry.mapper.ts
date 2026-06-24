import { InquiryEntity } from '../entity/inquiry.entity';
import { InquiryResponse } from '../dto/response/inquiry.response';

export class InquiryMapper {
  static toResponse(
    entity: InquiryEntity,
    warnings?: string[],
  ): InquiryResponse {
    return {
      id: entity.id,
      exporterId: entity.exporterId,
      exportCountryCode: entity.exportCountryCode,
      importCountryCode: entity.importCountryCode,
      title: entity.title,
      memo: entity.memo,
      status: entity.status,
      completenessScore: entity.completenessScore
        ? Number(entity.completenessScore)
        : null,
      submittedAt: entity.submittedAt ? entity.submittedAt.toISOString() : null,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      ...(warnings && warnings.length > 0 ? { warnings } : {}),
    };
  }

  static toListResponse(entities: InquiryEntity[]): InquiryResponse[] {
    return entities.map((e) => InquiryMapper.toResponse(e));
  }
}
