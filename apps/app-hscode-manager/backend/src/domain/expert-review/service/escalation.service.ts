import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  ExpertReviewEntity,
  ExpertRole,
} from '../entity/expert-review.entity';
import {
  ExpertKeywordDictionaryEntity,
} from '../entity/expert-keyword-dictionary.entity';
import { ClassificationEntity } from '../../classification/entity/classification.entity';
import { ClassificationCandidateEntity } from '../../classification/entity/classification-candidate.entity';
import { InquiryEntity } from '../../inquiry/entity/inquiry.entity';
import { ItemEntity } from '../../item/entity/item.entity';
import { VerificationEventEntity } from '../../verification/entity/verification-event.entity';
import { extractKeywords } from '../../../common/util/keywords';
import { AuditLogService } from '../../audit-log/service/audit-log.service';
import { PolicyService } from '../../admin/service/policy.service';

export type EscalationTriggerReason =
  | 'LOW_CONFIDENCE'         // (a) confidence < 0.6
  | 'MULTIPLE_CANDIDATES'    // (b) 후보 >=3 + 1·2위 confidence 격차 < 0.1
  | 'PROHIBITED_KEYWORD'     // (c) 키워드 사전 매칭
  | 'PAST_SEIZURE'           // (d) 동일 item / 동일 hsCode 과거 추징 이력
  | 'CUSTOMER_REQUEST'       // (e) Inquiry memo 에 명시
  | 'AMOUNT_THRESHOLD'       // (f) 거래 금액 > 임계
  | 'OTHER_CATEGORY'         // OTHER 카테고리 자동
  | 'CUSTOMS_SEIZURE_AUTO';  // Phase 5 연동

export interface EscalationContext {
  entId: string;
  userId: string | null;
  userEmail: string | null;
  classificationId: string;
  /** 거래 금액 (Inquiry 메모 또는 별도 전달) */
  amountUsd?: number;
  /** 고객사 명시 요청 플래그 (Inquiry 메모 분석 또는 명시 입력) */
  customerExplicitRequest?: boolean;
}

export interface EscalationTriggerInfo {
  reason: EscalationTriggerReason;
  detail: string;
  severity: number; // 0~100
  routing?: ExpertRole;
}

export interface EscalationResult {
  triggered: boolean;
  triggers: EscalationTriggerInfo[];
  createdReviews: ExpertReviewEntity[];
}

// 임계값은 PolicyService 를 통해 DB lookup (수입국별 override) — 코드 상수는 fallback 으로 PolicyService.DEFAULTS 에 존재.

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectRepository(ExpertReviewEntity)
    private readonly reviewRepo: Repository<ExpertReviewEntity>,
    @InjectRepository(ExpertKeywordDictionaryEntity)
    private readonly kwRepo: Repository<ExpertKeywordDictionaryEntity>,
    @InjectRepository(ClassificationEntity)
    private readonly clsRepo: Repository<ClassificationEntity>,
    @InjectRepository(ClassificationCandidateEntity)
    private readonly candidateRepo: Repository<ClassificationCandidateEntity>,
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepo: Repository<InquiryEntity>,
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    @InjectRepository(VerificationEventEntity)
    private readonly verRepo: Repository<VerificationEventEntity>,
    private readonly auditLog: AuditLogService,
    private readonly policy: PolicyService,
  ) {}

  /**
   * 6개 트리거 검사 + 트리거 충족 시 ExpertReview 자동 생성 + Inquiry 상태 REVIEWING 전이.
   * Classification 컨펌 직후 호출되는 것을 가정. (또는 CUSTOMS_SEIZURE 발생 시 명시 호출)
   *
   * 동일 트랜잭션에서 호출되려면 manager를 전달, 별도 호출은 manager 없음.
   */
  async checkAndTriggerOnConfirm(
    ctx: EscalationContext,
    manager?: EntityManager,
  ): Promise<EscalationResult> {
    const reviewRepo = manager
      ? manager.getRepository(ExpertReviewEntity)
      : this.reviewRepo;
    const inquiryRepoTx = manager
      ? manager.getRepository(InquiryEntity)
      : this.inquiryRepo;

    const cls = await this.clsRepo.findOne({
      where: { id: ctx.classificationId, entId: ctx.entId, deletedAt: IsNull() },
    });
    if (!cls) return { triggered: false, triggers: [], createdReviews: [] };

    const inquiry = await this.inquiryRepo.findOne({
      where: { id: cls.inquiryId, entId: ctx.entId },
    });
    const item = await this.itemRepo.findOne({
      where: { id: cls.itemId, entId: ctx.entId },
    });
    const candidates = await this.candidateRepo.find({
      where: { entId: ctx.entId, classificationId: cls.id },
      order: { ranking: 'ASC' },
    });

    const triggers: EscalationTriggerInfo[] = [];

    // 정책 임계값 lookup (수입국별 override 우선)
    const importCountry = inquiry?.importCountryCode ?? undefined;
    const [
      confidenceCutoff,
      multiCandidateGap,
      amountThreshold,
    ] = await Promise.all([
      this.policy.getNumber('confidence_cutoff', importCountry),
      this.policy.getNumber('multi_candidate_gap', importCountry),
      this.policy.getNumber('escalation_amount_usd', importCountry),
    ]);

    // (a) LOW_CONFIDENCE
    const conf = cls.confidenceScore ? Number(cls.confidenceScore) : 0;
    if (conf < confidenceCutoff) {
      triggers.push({
        reason: 'LOW_CONFIDENCE',
        detail: `Confidence ${conf.toFixed(2)} < ${confidenceCutoff}`,
        severity: 60,
        routing: 'EXPERT_INTERNAL',
      });
    }

    // (b) MULTIPLE_CANDIDATES — 후보 ≥3 + 1·2위 gap < 0.1
    if (candidates.length >= 3) {
      const c1 = Number(candidates[0]?.confidence ?? 0);
      const c2 = Number(candidates[1]?.confidence ?? 0);
      if (Math.abs(c1 - c2) < multiCandidateGap) {
        triggers.push({
          reason: 'MULTIPLE_CANDIDATES',
          detail: `${candidates.length} candidates with rank-1/2 gap ${Math.abs(c1 - c2).toFixed(3)}`,
          severity: 50,
          routing: 'EXPERT_INTERNAL',
        });
      }
    }

    // (c) PROHIBITED_KEYWORD — 키워드 사전 매칭
    if (item && inquiry?.importCountryCode) {
      const keywords = extractKeywords(
        item.category,
        item.nameRaw,
        (item.specAttributes ?? {}) as Record<string, unknown>,
      );
      const dictRows = await this.kwRepo.find({
        where: {
          importCountryCode: inquiry.importCountryCode,
          deletedAt: IsNull(),
        },
      });
      const matched: ExpertKeywordDictionaryEntity[] = [];
      const lowerKw = keywords.map((k) => k.toLowerCase());
      const itemText = `${item.nameRaw} ${item.usageDescription ?? ''}`.toLowerCase();
      for (const row of dictRows) {
        const k = row.keyword.toLowerCase();
        if (lowerKw.includes(k) || itemText.includes(k)) {
          matched.push(row);
        }
      }
      if (matched.length > 0) {
        const maxSeverity = Math.max(...matched.map((m) => m.severity));
        const localHint = matched.some((m) => m.routingHint === 'EXPERT_LOCAL');
        triggers.push({
          reason: 'PROHIBITED_KEYWORD',
          detail: `Matched keywords: ${matched.map((m) => m.keyword).slice(0, 5).join(', ')}`,
          severity: Math.min(100, maxSeverity),
          routing: localHint ? 'EXPERT_LOCAL' : 'EXPERT_INTERNAL',
        });
      }
    }

    // (d) PAST_SEIZURE — 동일 item 또는 동일 hsCode 추징 이력
    const seizureRows = await this.verRepo
      .createQueryBuilder('v')
      .innerJoin(ClassificationEntity, 'c', 'c.id = v.classificationId')
      .where('v.entId = :ent', { ent: ctx.entId })
      .andWhere('v.eventType = :t', { t: 'CUSTOMS_SEIZURE' })
      .andWhere('v.deletedAt IS NULL')
      .andWhere('(c.itemId = :item OR c.hsCode = :hs)', {
        item: cls.itemId,
        hs: cls.hsCode,
      })
      .andWhere('v.id <> :vid', { vid: '00000000-0000-0000-0000-000000000000' })
      .limit(1)
      .getOne();
    if (seizureRows) {
      triggers.push({
        reason: 'PAST_SEIZURE',
        detail: `Past CUSTOMS_SEIZURE on same item or hsCode (event=${seizureRows.id})`,
        severity: 90,
        routing: 'EXPERT_LOCAL',
      });
    }

    // (e) CUSTOMER_REQUEST — Inquiry memo 분석 or 명시 플래그
    const memoLow = (inquiry?.memo ?? '').toLowerCase();
    if (
      ctx.customerExplicitRequest ||
      /\b(expert|전문가|specialist|escalat)/i.test(memoLow)
    ) {
      triggers.push({
        reason: 'CUSTOMER_REQUEST',
        detail: 'Customer explicit expert request',
        severity: 70,
        routing: 'EXPERT_INTERNAL',
      });
    }

    // (f) AMOUNT_THRESHOLD
    if (
      ctx.amountUsd !== undefined &&
      ctx.amountUsd > amountThreshold
    ) {
      triggers.push({
        reason: 'AMOUNT_THRESHOLD',
        detail: `Amount $${ctx.amountUsd.toLocaleString()} > $${amountThreshold.toLocaleString()}`,
        severity: 65,
        routing: 'EXPERT_INTERNAL',
      });
    }

    // OTHER 카테고리는 자동 트리거
    if (item?.category === 'OTHER') {
      triggers.push({
        reason: 'OTHER_CATEGORY',
        detail: 'Category=OTHER requires expert reclassification',
        severity: 70,
        routing: 'EXPERT_INTERNAL',
      });
    }

    if (triggers.length === 0) {
      return { triggered: false, triggers: [], createdReviews: [] };
    }

    // 라우팅 결정 — 양쪽 모두 걸리면 병렬 (2건 생성)
    const needsLocal = triggers.some((t) => t.routing === 'EXPERT_LOCAL');
    const needsInternal = triggers.some((t) => t.routing === 'EXPERT_INTERNAL');
    const routes: ExpertRole[] = [];
    if (needsLocal) routes.push('EXPERT_LOCAL');
    if (needsInternal && !routes.includes('EXPERT_INTERNAL'))
      routes.push('EXPERT_INTERNAL');
    if (routes.length === 0) routes.push('EXPERT_INTERNAL');

    // 중복 ExpertReview 방지 — 동일 (classification_id, expert_role, PENDING) 가 있으면 skip
    const created: ExpertReviewEntity[] = [];
    for (const role of routes) {
      const existing = await reviewRepo.findOne({
        where: {
          entId: ctx.entId,
          classificationId: cls.id,
          expertRole: role,
          verdict: 'PENDING',
          deletedAt: IsNull(),
        },
      });
      if (existing) {
        this.logger.debug(
          `Skip duplicate ExpertReview for cls=${cls.id} role=${role}`,
        );
        continue;
      }
      const review = reviewRepo.create({
        id: uuid(),
        entId: ctx.entId,
        classificationId: cls.id,
        expertRole: role,
        triggerReason: triggers.map((t) => t.reason).join(','),
        requestedAt: new Date(),
        verdict: 'PENDING',
        notes: triggers.map((t) => `[${t.reason}] ${t.detail}`).join('\n'),
      });
      await reviewRepo.save(review);
      created.push(review);
    }

    // Inquiry 상태 → REVIEWING
    if (inquiry && inquiry.status !== 'REVIEWING' && created.length > 0) {
      inquiry.status = 'REVIEWING';
      await inquiryRepoTx.save(inquiry);
    }

    // 감사 로그
    for (const r of created) {
      await this.auditLog.record({
        entId: ctx.entId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action: 'CREATE',
        targetTable: 'hsc_expert_reviews',
        targetId: r.id,
        diff: {
          classification_id: cls.id,
          expert_role: r.expertRole,
          triggers: triggers.map((t) => t.reason),
        },
      });
    }

    return { triggered: true, triggers, createdReviews: created };
  }

  /** 응대 양식 차단 가드 — Inquiry/Classification 에 미해결 ExpertReview 가 있으면 true */
  async isBlocked(entId: string, classificationId: string): Promise<boolean> {
    const cnt = await this.reviewRepo.count({
      where: {
        entId,
        classificationId,
        verdict: 'PENDING',
        deletedAt: IsNull(),
      },
    });
    return cnt > 0;
  }
}
