import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLog } from '../entity/query-log.entity';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';
import { ClarifyingQuestionService } from '../../search-core/service/clarifying-question.service';
import { AuditService } from '../../audit/service/audit.service';
import { QaSearchRequest } from '../dto/request/qa-search.request';
import { ConfirmQaRequest } from '../dto/request/confirm-qa.request';
import {
  CandidateResponse,
  ConfirmQaResponse,
  QaSearchResponse,
} from '../dto/response/qa-search.response';

@Injectable()
export class QaService {
  constructor(
    @InjectRepository(QueryLog)
    private readonly queryLogRepo: Repository<QueryLog>,
    private readonly retrieval: SemanticRetrievalService,
    private readonly clarify: ClarifyingQuestionService,
    private readonly audit: AuditService,
  ) {}

  /** FR-001~004 — 의미검색 후보 + 명확화 판단 */
  async search(entId: string, dto: QaSearchRequest): Promise<QaSearchResponse> {
    const candidates = await this.retrieval.retrieve(
      entId,
      dto.query_text,
      5,
      dto.constraints,
    );
    const decision = this.clarify.decide(candidates, dto.round_count ?? 0);

    const mapped: CandidateResponse[] = candidates.map((c) => ({
      hsCode: c.hsCode,
      hs6: c.hs6,
      description: c.description,
      origin: c.origin,
      unit: c.unit,
      score: c.score,
      sourceRefId: c.sourceRefId,
      sourceCompany: c.sourceCompany,
      refCount: c.refCount,
    }));

    return {
      candidates: mapped,
      needQuestion: decision.needQuestion,
      attributeKey: decision.attributeKey,
    };
  }

  /** FR-005 — 확정 시 이력 저장 + 감사 기록 */
  async confirm(
    entId: string,
    userId: string,
    dto: ConfirmQaRequest,
  ): Promise<ConfirmQaResponse> {
    const log = await this.queryLogRepo.save(
      this.queryLogRepo.create({
        entId,
        mode: 'QA',
        inputText: dto.input_text,
        resultHs: dto.hs_code,
        confidence: dto.confidence.toFixed(3),
        hsReferenceId: dto.hsr_id ?? null,
        userId,
        sessionId: dto.session_id ?? null,
      }),
    );

    await this.audit.record({
      entId,
      queryType: 'QA',
      input: dto.input_text,
      resolvedHs: dto.hs_code,
      source: 'REFERENCE',
      confidence: dto.confidence,
      verifier: userId,
    });

    return {
      logId: log.qlgId,
      hsCode: dto.hs_code,
      hs6: dto.hs6,
      confidence: dto.confidence,
    };
  }
}
