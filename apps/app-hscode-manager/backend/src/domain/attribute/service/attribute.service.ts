import { Injectable } from '@nestjs/common';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';
import { AiClassificationService } from '../../search-core/service/ai-classification.service';
import { Candidate, SearchConstraints } from '../../search-core/candidate.types';
import { ClassifyAttributeRequest } from '../dto/request/classify-attribute.request';

/** FN-030 — 속성 폼을 검색 코어로 라우팅 (Feature A 엔진 재사용, FR-030/033). */
@Injectable()
export class AttributeService {
  constructor(
    private readonly retrieval: SemanticRetrievalService,
    private readonly ai: AiClassificationService,
  ) {}

  async classify(entId: string, dto: ClassifyAttributeRequest): Promise<{ candidates: Candidate[] }> {
    const constraints: SearchConstraints = {
      material: dto.material,
      usage: dto.usage,
      processing: dto.processing,
      origin: dto.origin,
      unit: dto.unit,
    };
    const retrieved = await this.retrieval.retrieve(entId, dto.name, 5, constraints);
    // FR-033 — Feature A와 동일 AI 판정. 미설정/오류 시 검색 순위로 graceful fallback (R4).
    const ai = await this.ai.classify(entId, dto.name, constraints, retrieved);
    return { candidates: ai?.candidates ?? retrieved };
  }
}
