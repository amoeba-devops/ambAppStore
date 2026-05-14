import { ClassificationEntity } from '../entity/classification.entity';
import { ClassificationCandidateEntity } from '../entity/classification-candidate.entity';
import {
  ClassificationCandidateResponse,
  ClassificationResponse,
} from '../dto/response/classification.response';

const num = (s: string | null): number | null =>
  s === null || s === undefined ? null : Number(s);

export class ClassificationMapper {
  static toResponse(
    entity: ClassificationEntity,
    candidates?: ClassificationCandidateEntity[],
    extras?: {
      inquiry?: ClassificationResponse['inquiry'];
      item?: ClassificationResponse['item'];
    },
  ): ClassificationResponse {
    return {
      id: entity.id,
      inquiryId: entity.inquiryId,
      itemId: entity.itemId,
      hsCode: entity.hsCode,
      basicTariffRate: num(entity.basicTariffRate),
      ftaTariffRate: num(entity.ftaTariffRate),
      ftaAgreementCode: entity.ftaAgreementCode,
      confidenceScore: num(entity.confidenceScore),
      status: entity.status,
      recommendationSource: entity.recommendationSource,
      aiReasoning: entity.aiReasoning,
      aiModelVersion: entity.aiModelVersion,
      externalSources: entity.externalSources,
      selectionRationale: entity.selectionRationale,
      adoptedAt: entity.adoptedAt ? entity.adoptedAt.toISOString() : null,
      supersededAt: entity.supersededAt ? entity.supersededAt.toISOString() : null,
      supersededById: entity.supersededById,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      ...(candidates && {
        candidates: candidates.map(ClassificationMapper.toCandidateResponse),
      }),
      ...(extras?.inquiry && { inquiry: extras.inquiry }),
      ...(extras?.item && { item: extras.item }),
    };
  }

  static toCandidateResponse(
    e: ClassificationCandidateEntity,
  ): ClassificationCandidateResponse {
    return {
      id: e.id,
      hsCode: e.hsCode,
      description: e.description,
      basicTariffRate: num(e.basicTariffRate),
      ftaTariffRate: num(e.ftaTariffRate),
      ftaAgreementCode: e.ftaAgreementCode,
      source: e.source,
      ranking: e.ranking,
      confidence: num(e.confidence),
      reasoning: e.reasoning,
      sourceCitations: e.sourceCitations ?? [],
      externalAdapterKeys: e.externalAdapterKeys ?? [],
      flags: e.flags,
      pastAdoptionCount: e.pastAdoptionCount,
    };
  }

  static toListResponse(entities: ClassificationEntity[]): ClassificationResponse[] {
    return entities.map((e) => ClassificationMapper.toResponse(e));
  }
}
