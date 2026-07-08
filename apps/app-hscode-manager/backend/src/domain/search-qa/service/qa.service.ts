import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLog } from '../entity/query-log.entity';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';
import { ClarifyingQuestionService } from '../../search-core/service/clarifying-question.service';
import { AiClassificationService } from '../../search-core/service/ai-classification.service';
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
    private readonly ai: AiClassificationService,
    private readonly audit: AuditService,
  ) {}

  /** FR-001~004 — RAG 검색 후보 → 설정 Claude 근거 판정(가능 시), 미설정/오류 시 검색 순위 폴백 */
  async search(entId: string, dto: QaSearchRequest): Promise<QaSearchResponse> {
    const retrieved = await this.retrieval.retrieve(entId, dto.query_text, 5, dto.constraints);

    // FR-002/003/006 — AI가 후보를 근거 기반 재판정. null이면 검색 순위로 graceful fallback (R4).
    const ai = await this.ai.classify(entId, dto.query_text, dto.constraints, retrieved);
    const candidates = ai?.candidates ?? retrieved;
    const decision = ai
      ? { needQuestion: ai.needQuestion, attributeKey: ai.attributeKey }
      : this.clarify.decide(retrieved, dto.round_count ?? 0);

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
      rationale: c.rationale,
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
