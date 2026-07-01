import { Injectable } from '@nestjs/common';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';
import { Candidate } from '../../search-core/candidate.types';
import { ClassifyAttributeRequest } from '../dto/request/classify-attribute.request';

/** FN-030 — 속성 폼을 검색 코어로 라우팅 (Feature A 엔진 재사용, FR-030/033). */
@Injectable()
export class AttributeService {
  constructor(private readonly retrieval: SemanticRetrievalService) {}

  async classify(entId: string, dto: ClassifyAttributeRequest): Promise<{ candidates: Candidate[] }> {
    const candidates = await this.retrieval.retrieve(entId, dto.name, 5, {
      material: dto.material,
      usage: dto.usage,
      processing: dto.processing,
      origin: dto.origin,
      unit: dto.unit,
    });
    return { candidates };
  }
}
