import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource, In, Repository } from 'typeorm';
import { MatchRequest } from '../entity/match-request.entity';
import { Item } from '../entity/item.entity';
import { Recommendation } from '../entity/recommendation.entity';
import { MATCHING_QUEUE } from '../matching.constants';
import { DocumentParserService } from './document-parser.service';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';
import { AiClassificationService } from '../../search-core/service/ai-classification.service';
import { Candidate, SearchConstraints } from '../../search-core/candidate.types';
import { KnowledgeRetrievalService } from '../../knowledge/service/knowledge-retrieval.service';
import { ReferenceService } from '../../reference/service/reference.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { PaginatedData } from '../../../common/dto/pagination.dto';

/** 요청건 상세 = 요청 + 품목별 추천. */
export interface RequestDetail {
  request: MatchRequest;
  items: Array<{ item: Item; recommendations: Recommendation[] }>;
}

/** 승인 항목: 품목 itemId 에 대해 채택한 HS(hsCode). */
export interface ConfirmApproval {
  itemId: string;
  hsCode: string;
}

const TOP_CANDIDATES = 3; // 품목당 저장 후보 수
const REVIEW_THRESHOLD = 0.5; // 최상위 신뢰도 미만 → 검토필요/에스컬레이션

/**
 * 문서 업로드 매칭 (Phase 2, 주 기능) — 파싱 → 품목별 RAG 매칭 → 추천 → 승인/컨펌 → 요청건 저장.
 * 기존 자산 재사용: SemanticRetrieval(면장 하이브리드) + KnowledgeRetrieval(기준표/지식) + AiClassification.
 * 확정 시 ReferenceService.saveEntry 로 LEARNED 재저장(자기개선 루프, R5/R8).
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(MatchRequest)
    private readonly requestRepo: Repository<MatchRequest>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Recommendation)
    private readonly recRepo: Repository<Recommendation>,
    private readonly parser: DocumentParserService,
    private readonly retrieval: SemanticRetrievalService,
    private readonly knowledge: KnowledgeRetrievalService,
    private readonly ai: AiClassificationService,
    private readonly reference: ReferenceService,
    private readonly dataSource: DataSource,
    @InjectQueue(MATCHING_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * 업로드 → 파싱 → 요청건(PROCESSING)+품목 생성 → 큐 투입 → 요청 요약 반환(대량 비동기).
   * 실제 매칭은 워커(processRequest)가 백그라운드로 수행. 프론트는 폴링으로 진행률/결과 조회.
   */
  async uploadAndEnqueue(
    entId: string,
    userId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<RequestDetail> {
    const parsed = await this.parser.parse(entId, fileName, buffer);

    const request = await this.requestRepo.save(
      this.requestRepo.create({
        entId,
        fileName,
        sourceType: parsed.sourceType,
        status: 'PROCESSING',
        itemCount: parsed.items.length,
        parseNote: parsed.note,
        createdBy: userId,
      }),
    );

    // 품목 생성(추천 없음 — 워커가 채움). 매칭 입력은 저장된 필드에서 복원.
    if (parsed.items.length > 0) {
      await this.itemRepo.save(
        parsed.items.map((p) =>
          this.itemRepo.create({
            entId,
            mrqId: request.mrqId,
            rowIndex: p.rowIndex,
            productNameKo: p.name.slice(0, 200) || null,
            description: [p.name, p.material, p.usage].filter(Boolean).join(' / ') || null,
            mainMaterial: p.material?.slice(0, 200) ?? null,
            intendedUse: p.usage?.slice(0, 200) ?? null,
            importCountry: 'VN',
            status: 'NEW',
            needsReview: p.needsReview,
            rawSource: p.rawSource || null,
          }),
        ),
        { chunk: 500 },
      );
    }

    // 빈 파일이면 즉시 READY. 아니면 큐 투입.
    if (parsed.items.length === 0) {
      await this.requestRepo.update({ mrqId: request.mrqId }, { status: 'READY' });
    } else {
      await this.queue.add(
        'process',
        { entId, mrqId: request.mrqId },
        { removeOnComplete: true, removeOnFail: 50 },
      );
    }

    return this.getRequestDetail(entId, request.mrqId);
  }

  /**
   * 워커 진입점 — 요청건의 미처리 품목을 순회 매칭. 품목별 processed_count 갱신, 완료 시 READY.
   * 개별 품목 오류는 격리(검토필요로 표시)하고 계속(R4).
   */
  async processRequest(entId: string, mrqId: string): Promise<void> {
    const request = await this.requestRepo.findOne({ where: { mrqId, entId } });
    if (!request) return;

    const items = await this.itemRepo.find({
      where: { mrqId, entId },
      order: { rowIndex: 'ASC' },
    });

    let matched = 0;
    let review = 0;
    let processed = 0;
    for (const item of items) {
      try {
        const hadRecs = await this.matchItem(entId, item);
        if (hadRecs) matched += 1;
      } catch (err) {
        this.logger.warn(`matchItem failed for item ${item.itmId}: ${String(err)}`);
        item.needsReview = true;
        await this.itemRepo.save(item);
      }
      if (item.needsReview) review += 1;
      processed += 1;
      await this.requestRepo.update({ mrqId }, { processedCount: processed });
    }

    await this.requestRepo.update(
      { mrqId },
      { status: 'READY', matchedCount: matched, reviewCount: review, processedCount: processed },
    );
    this.logger.log(`Request ${mrqId} done: ${processed} items, ${matched} matched, ${review} review.`);
  }

  /** 단일 품목 매칭(기존 Item 기반): 면장+지식 회수 → AI 재판정 → 추천 저장. 추천 유무 반환. */
  private async matchItem(entId: string, item: Item): Promise<boolean> {
    const name = item.productNameKo ?? '';
    if (!name) {
      if (!item.needsReview) {
        item.needsReview = true;
        await this.itemRepo.save(item);
      }
      return false;
    }

    const constraints: SearchConstraints = {
      material: item.mainMaterial ?? undefined,
      usage: item.intendedUse ?? undefined,
    };
    const retrieved = await this.retrieval.retrieve(entId, name, 5, constraints);
    const snippets = await this.knowledge.retrieve(
      entId,
      [name, item.mainMaterial].filter(Boolean).join(' '),
      3,
    );
    const aiRes = await this.ai.classify(entId, name, constraints, retrieved);
    const candidates = (aiRes?.candidates ?? retrieved).slice(0, TOP_CANDIDATES);

    if (candidates.length === 0) {
      item.needsReview = true;
      await this.itemRepo.save(item);
      return false;
    }

    const topScore = candidates[0].score;
    const needsReview = topScore < REVIEW_THRESHOLD;
    if (needsReview !== item.needsReview) {
      item.needsReview = needsReview;
      await this.itemRepo.save(item);
    }

    const knowledgeIds = snippets.map((s) => s.chunkId);
    await this.recRepo.save(
      candidates.map((c, idx) =>
        this.recRepo.create({
          itmId: item.itmId,
          entId,
          rank: idx + 1,
          hsVn: c.hsCode,
          confidenceScore: c.score.toFixed(4),
          reasoningText: this.reasoning(c, snippets.length),
          supportingChunks: [c.sourceRefId, ...knowledgeIds].filter(Boolean) as string[],
          isEscalationRequired: idx === 0 && needsReview,
        }),
      ),
    );
    return true;
  }

  private reasoning(c: Candidate, snippetCount: number): string {
    if (c.rationale) return c.rationale;
    const base = `면장 코퍼스 유사 매칭 (동일 HS6 근거 ${c.refCount}건)`;
    return snippetCount > 0 ? `${base}, 기준표/지식 ${snippetCount}건 참조` : base;
  }

  /** 요청건 상세(품목 + 추천). ent_id 스코핑. */
  async getRequestDetail(entId: string, mrqId: string): Promise<RequestDetail> {
    const request = await this.requestRepo.findOne({ where: { mrqId, entId } });
    if (!request) {
      throw new BusinessException(
        ERROR_CODES.SETTING_NOT_FOUND,
        'Match request not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const items = await this.itemRepo.find({
      where: { mrqId, entId },
      order: { rowIndex: 'ASC' },
    });
    const recs = items.length
      ? await this.recRepo.find({
          where: { itmId: In(items.map((i) => i.itmId)) },
          order: { rank: 'ASC' },
        })
      : [];
    const byItem = new Map<string, Recommendation[]>();
    for (const r of recs) {
      const arr = byItem.get(r.itmId) ?? [];
      arr.push(r);
      byItem.set(r.itmId, arr);
    }
    return {
      request,
      items: items.map((item) => ({ item, recommendations: byItem.get(item.itmId) ?? [] })),
    };
  }

  /** 요청건 이력 목록(SCR-5). */
  async listRequests(entId: string, page = 1, size = 20): Promise<PaginatedData<MatchRequest>> {
    const [items, total] = await this.requestRepo.findAndCount({
      where: { entId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { items, total, page, size };
  }

  /**
   * 승인/컨펌 → 요청건 저장(R5) + 확정분 LEARNED 재저장(R8).
   * approvals 의 각 품목에 대해: 채택 추천 ADOPTED, 품목 CONFIRMED, class_case 축적, reference 저장.
   */
  async confirm(
    entId: string,
    userId: string,
    mrqId: string,
    approvals: ConfirmApproval[],
  ): Promise<RequestDetail> {
    const request = await this.requestRepo.findOne({ where: { mrqId, entId } });
    if (!request) {
      throw new BusinessException(
        ERROR_CODES.SETTING_NOT_FOUND,
        'Match request not found',
        HttpStatus.NOT_FOUND,
      );
    }

    let confirmed = 0;
    for (const a of approvals) {
      const item = await this.itemRepo.findOne({ where: { itmId: a.itemId, entId, mrqId } });
      if (!item) continue;

      const recs = await this.recRepo.find({ where: { itmId: item.itmId } });
      const chosen = recs.find((r) => r.hsVn === a.hsCode);

      // 추천 상태 갱신: 채택=ADOPTED, 나머지=REJECTED.
      for (const r of recs) {
        r.finalUserAction = r.hsVn === a.hsCode ? 'ADOPTED' : 'REJECTED';
      }
      if (recs.length) await this.recRepo.save(recs);

      item.status = 'CONFIRMED';
      item.needsReview = false;
      await this.itemRepo.save(item);

      // class_case 축적(판정 이력).
      await this.dataSource.query(
        `INSERT INTO hsm_class_cases
           (ent_id, cas_item_signature, cas_jurisdiction, cas_recommended_hs, cas_final_hs,
            cas_reasoning_summary, cas_main_material, cas_reviewer_type, cas_review_status)
         VALUES ($1,$2,'VN',$3,$4,$5,$6,'CUSTOMS_BROKER','CONFIRMED')`,
        [
          entId,
          item.description ?? item.productNameKo ?? '',
          chosen?.hsVn ?? a.hsCode,
          a.hsCode,
          chosen?.reasoningText ?? null,
          item.mainMaterial,
        ],
      );

      // 확정분 → reference 재저장(자기개선 루프). 감사·임베딩 포함.
      await this.reference.saveEntry(entId, userId, {
        hs_code: a.hsCode,
        description: item.description ?? item.productNameKo ?? a.hsCode,
        source_company: request.fileName ?? 'MATCH_CONFIRM',
      });
      confirmed += 1;
    }

    request.confirmedCount = (request.confirmedCount ?? 0) + confirmed;
    request.status = request.confirmedCount >= request.itemCount ? 'CONFIRMED' : request.status;
    await this.requestRepo.save(request);

    return this.getRequestDetail(entId, mrqId);
  }
}
