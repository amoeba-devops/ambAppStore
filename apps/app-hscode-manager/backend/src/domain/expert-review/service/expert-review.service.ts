import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  ExpertReviewEntity,
  ExpertRole,
  ReviewVerdict,
} from '../entity/expert-review.entity';
import { ClassificationEntity } from '../../classification/entity/classification.entity';
import { InquiryEntity } from '../../inquiry/entity/inquiry.entity';
import { ItemEntity } from '../../item/entity/item.entity';
import { RespondReviewRequest } from '../dto/request/respond-review.request';
import { HscodeErrorCode } from '../../../common/error-codes';
import { AuditLogService } from '../../audit-log/service/audit-log.service';
import type { ExpertReviewResponse } from '../dto/response/expert-review.response';

export interface ListReviewsQuery {
  /** 본인 역할 기준 — 'EXPERT_LOCAL' 사용자는 'EXPERT_LOCAL' 큐만 본다 */
  role?: ExpertRole;
  verdict?: ReviewVerdict;
  classificationId?: string;
}

@Injectable()
export class ExpertReviewService {
  constructor(
    @InjectRepository(ExpertReviewEntity)
    private readonly reviewRepo: Repository<ExpertReviewEntity>,
    @InjectRepository(ClassificationEntity)
    private readonly clsRepo: Repository<ClassificationEntity>,
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepo: Repository<InquiryEntity>,
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    entId: string,
    query: ListReviewsQuery,
  ): Promise<{ items: ExpertReviewEntity[]; contexts: Map<string, ExpertReviewResponse['context']> }> {
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .where('r.entId = :ent', { ent: entId })
      .andWhere('r.deletedAt IS NULL')
      .orderBy('r.verdict', 'ASC') // PENDING 먼저
      .addOrderBy('r.requestedAt', 'DESC');

    if (query.role) qb.andWhere('r.expertRole = :role', { role: query.role });
    if (query.verdict)
      qb.andWhere('r.verdict = :v', { v: query.verdict });
    if (query.classificationId)
      qb.andWhere('r.classificationId = :cls', { cls: query.classificationId });

    const items = await qb.getMany();
    const contexts = await this.buildContexts(entId, items);
    return { items, contexts };
  }

  async findById(entId: string, id: string): Promise<ExpertReviewEntity> {
    const e = await this.reviewRepo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `ExpertReview not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return e;
  }

  async getDetail(
    entId: string,
    id: string,
  ): Promise<{
    review: ExpertReviewEntity;
    context: ExpertReviewResponse['context'];
  }> {
    const r = await this.findById(entId, id);
    const ctxMap = await this.buildContexts(entId, [r]);
    return { review: r, context: ctxMap.get(r.id) };
  }

  /**
   * 회신 처리 — APPROVE/REVISE/REJECT
   * - APPROVE: Inquiry 상태 RESPONDED 로 복귀 (단, 다른 미해결 review 가 없을 때만)
   * - REVISE: Classification 재컨펌 필요 — Inquiry 상태 MATCHING 으로 되돌림
   * - REJECT: Classification DISPUTED 전이 + Inquiry DISPUTED
   */
  async respond(
    entId: string,
    userId: string | null,
    userEmail: string | null,
    id: string,
    dto: RespondReviewRequest,
  ): Promise<ExpertReviewEntity> {
    const review = await this.findById(entId, id);
    if (review.verdict !== 'PENDING') {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Review already resolved: verdict=${review.verdict}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    review.verdict = dto.verdict;
    review.respondedAt = new Date();
    if (dto.notes !== undefined) {
      review.notes = review.notes
        ? `${review.notes}\n\n[Expert reply]\n${dto.notes}`
        : `[Expert reply]\n${dto.notes}`;
    }
    await this.reviewRepo.save(review);

    // 분류 / 문의 상태 갱신
    const cls = await this.clsRepo.findOne({
      where: { id: review.classificationId, entId, deletedAt: IsNull() },
    });
    if (cls) {
      const inquiry = await this.inquiryRepo.findOne({
        where: { id: cls.inquiryId, entId },
      });
      // 동일 분류의 다른 미해결 review 가 남아있나?
      const otherPending = await this.reviewRepo.count({
        where: {
          entId,
          classificationId: review.classificationId,
          verdict: 'PENDING',
          deletedAt: IsNull(),
        },
      });

      switch (dto.verdict) {
        case 'APPROVE':
          if (otherPending === 0 && inquiry?.status === 'REVIEWING') {
            inquiry.status = 'RESPONDED';
            await this.inquiryRepo.save(inquiry);
          }
          break;
        case 'REVISE':
          if (otherPending === 0 && inquiry?.status === 'REVIEWING') {
            inquiry.status = 'MATCHING';
            await this.inquiryRepo.save(inquiry);
          }
          break;
        case 'REJECT':
          if (cls.status === 'ADOPTED' || cls.status === 'SEALED') {
            cls.status = 'DISPUTED';
            await this.clsRepo.save(cls);
          }
          if (inquiry && inquiry.status !== 'DISPUTED') {
            inquiry.status = 'DISPUTED';
            await this.inquiryRepo.save(inquiry);
          }
          break;
      }
    }

    await this.auditLog.record({
      entId,
      userId,
      userEmail,
      action: 'STATUS_CHANGE',
      targetTable: 'hsc_expert_reviews',
      targetId: review.id,
      diff: {
        verdict: dto.verdict,
        classification_id: review.classificationId,
      },
    });

    return review;
  }

  /** 본인에게 할당된 큐 (Phase 6 MVP — 역할 기준만, user_id 할당은 Phase 7) */
  async listAssignedToRole(
    entId: string,
    role: ExpertRole,
  ): Promise<{ items: ExpertReviewEntity[]; contexts: Map<string, ExpertReviewResponse['context']> }> {
    return this.list(entId, { role, verdict: 'PENDING' });
  }

  // ----- private -----

  private async buildContexts(
    entId: string,
    reviews: ExpertReviewEntity[],
  ): Promise<Map<string, ExpertReviewResponse['context']>> {
    const map = new Map<string, ExpertReviewResponse['context']>();
    if (reviews.length === 0) return map;

    const classifications = await this.clsRepo.find({
      where: { id: In(reviews.map((r) => r.classificationId)), entId },
    });
    const itemIds = classifications.map((c) => c.itemId).filter(Boolean);
    const inquiryIds = classifications.map((c) => c.inquiryId).filter(Boolean);
    const items = itemIds.length
      ? await this.itemRepo.find({ where: { id: In(itemIds), entId } })
      : [];
    const inquiries = inquiryIds.length
      ? await this.inquiryRepo.find({ where: { id: In(inquiryIds), entId } })
      : [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    const inqById = new Map(inquiries.map((i) => [i.id, i]));

    for (const r of reviews) {
      const c = classifications.find((cl) => cl.id === r.classificationId);
      if (!c) continue;
      const it = itemById.get(c.itemId);
      const inq = inqById.get(c.inquiryId);
      map.set(r.id, {
        hsCode: c.hsCode,
        itemName: it?.nameRaw,
        category: it?.category,
        importCountryCode: inq?.importCountryCode ?? null,
        exportCountryCode: inq?.exportCountryCode ?? null,
      });
    }
    return map;
  }
}
