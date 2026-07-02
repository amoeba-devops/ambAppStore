import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  VerificationEventEntity,
  VerificationEventType,
  VerificationResult,
} from '../entity/verification-event.entity';
import {
  ReviewQueueEntity,
  ReviewReason,
  ReviewTargetType,
} from '../entity/review-queue.entity';
import { ClassificationEntity } from '../../classification/entity/classification.entity';
import { ItemEntity } from '../../item/entity/item.entity';
import { CreateVerificationRequest } from '../dto/request/create-verification.request';
import { HscodeErrorCode } from '../../../common/error-codes';
import { AuditLogService } from '../../audit-log/service/audit-log.service';
import { EscalationService } from '../../expert-review/service/escalation.service';

export interface CreateVerificationContext {
  entId: string;
  userId: string | null;
  userEmail: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface VerificationResult2 {
  event: VerificationEventEntity;
  followUpActions: Array<Record<string, unknown>>;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(VerificationEventEntity)
    private readonly eventRepo: Repository<VerificationEventEntity>,
    @InjectRepository(ReviewQueueEntity)
    private readonly queueRepo: Repository<ReviewQueueEntity>,
    @InjectRepository(ClassificationEntity)
    private readonly classificationRepo: Repository<ClassificationEntity>,
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    private readonly auditLog: AuditLogService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => EscalationService))
    private readonly escalation: EscalationService,
  ) {}

  /**
   * 검증 이벤트 등록 + 자동 후속 작업 트리거 (FR-VR-01·02).
   * 트랜잭션:
   *   1) 이벤트 레코드 저장
   *   2) 이벤트 유형별 follow-up:
   *      - SAMPLE_ANALYSIS + MATCH: classification.confidence +0.2
   *      - SAMPLE_ANALYSIS + MISMATCH: 원본 SUPERSEDED + 동일 Item 의 모든 ADOPTED/SEALED 분류를 재검토 큐에 적재
   *      - CUSTOMS_SEIZURE: classification → DISPUTED, 동일 hsCode 의 다른 모든 Classification 재검토 큐 적재
   *      - CUSTOMS_DOUBLE_CHECK: classification → SEALED + confidence +0.3
   *   3) confidence_delta + follow_up_actions JSON 영속화
   *   4) AuditLog 기록
   */
  async create(
    ctx: CreateVerificationContext,
    dto: CreateVerificationRequest,
  ): Promise<VerificationResult2> {
    const classification = await this.classificationRepo.findOne({
      where: {
        id: dto.classification_id,
        entId: ctx.entId,
        deletedAt: IsNull(),
      },
    });
    if (!classification) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Classification not found: ${dto.classification_id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    this.assertResultMatchesType(dto.event_type, dto.result);

    const result = await this.dataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(VerificationEventEntity);
      const clsRepo = manager.getRepository(ClassificationEntity);
      const queueRepo = manager.getRepository(ReviewQueueEntity);

      const eventId = uuid();
      const followUpActions: Array<Record<string, unknown>> = [];
      let confidenceDelta = 0;

      // === 후속 작업 분기 ===
      switch (dto.event_type) {
        case 'SAMPLE_ANALYSIS': {
          if (dto.result === 'MATCH') {
            confidenceDelta = 0.2;
            classification.confidenceScore = this.bumpConfidence(
              classification.confidenceScore,
              0.2,
            );
            await clsRepo.save(classification);
            followUpActions.push({ kind: 'CONFIDENCE_BUMP', delta: 0.2 });
          } else if (dto.result === 'MISMATCH') {
            // 원본 분류 SUPERSEDED 처리
            if (
              classification.status === 'ADOPTED' ||
              classification.status === 'SEALED'
            ) {
              classification.status = 'SUPERSEDED';
              classification.supersededAt = new Date();
              await clsRepo.save(classification);
              followUpActions.push({
                kind: 'STATUS_CHANGE',
                from: 'ADOPTED|SEALED',
                to: 'SUPERSEDED',
              });
            }
            // 동일 Item 의 모든 ADOPTED/SEALED 분류 재검토 큐 적재
            const itemId = classification.itemId;
            const otherClassifications = await clsRepo.find({
              where: { entId: ctx.entId, itemId, deletedAt: IsNull() },
            });
            const adopted = otherClassifications.filter(
              (c) => c.status === 'ADOPTED' || c.status === 'SEALED',
            );
            for (const c of adopted) {
              const exists = await queueRepo.findOne({
                where: {
                  entId: ctx.entId,
                  targetType: 'CLASSIFICATION' as ReviewTargetType,
                  targetId: c.id,
                  resolvedAt: IsNull(),
                },
              });
              if (exists) continue;
              await queueRepo.save(
                queueRepo.create({
                  id: uuid(),
                  entId: ctx.entId,
                  targetType: 'CLASSIFICATION',
                  targetId: c.id,
                  triggerEventId: eventId,
                  reason: 'SAMPLE_MISMATCH' as ReviewReason,
                  priority: 50,
                }),
              );
              followUpActions.push({
                kind: 'REVIEW_QUEUE',
                target_type: 'CLASSIFICATION',
                target_id: c.id,
                reason: 'SAMPLE_MISMATCH',
              });
            }
          }
          break;
        }

        case 'CUSTOMS_SEIZURE': {
          // 본 분류 DISPUTED 전환
          if (classification.status !== 'DISPUTED') {
            classification.status = 'DISPUTED';
            await clsRepo.save(classification);
            followUpActions.push({
              kind: 'STATUS_CHANGE',
              to: 'DISPUTED',
            });
          }
          // 동일 hsCode 사용 *다른* 분류 재검토 큐 적재
          const samePattern = await clsRepo.find({
            where: {
              entId: ctx.entId,
              hsCode: classification.hsCode,
              deletedAt: IsNull(),
            },
          });
          for (const c of samePattern) {
            if (c.id === classification.id) continue;
            if (c.status === 'SUPERSEDED' || c.status === 'DISPUTED') continue;
            const exists = await queueRepo.findOne({
              where: {
                entId: ctx.entId,
                targetType: 'CLASSIFICATION' as ReviewTargetType,
                targetId: c.id,
                resolvedAt: IsNull(),
              },
            });
            if (exists) continue;
            await queueRepo.save(
              queueRepo.create({
                id: uuid(),
                entId: ctx.entId,
                targetType: 'CLASSIFICATION',
                targetId: c.id,
                triggerEventId: eventId,
                reason: 'CUSTOMS_SEIZURE_PATTERN' as ReviewReason,
                priority: dto.amount_usd && dto.amount_usd > 50_000 ? 10 : 30,
              }),
            );
            followUpActions.push({
              kind: 'REVIEW_QUEUE',
              target_type: 'CLASSIFICATION',
              target_id: c.id,
              reason: 'CUSTOMS_SEIZURE_PATTERN',
            });
          }
          // 본 분류도 큐에 (별도 reason)
          await queueRepo.save(
            queueRepo.create({
              id: uuid(),
              entId: ctx.entId,
              targetType: 'CLASSIFICATION',
              targetId: classification.id,
              triggerEventId: eventId,
              reason: 'CUSTOMS_SEIZURE_DIRECT' as ReviewReason,
              priority: 5,
              notes: dto.notes ?? null,
            }),
          );
          followUpActions.push({
            kind: 'REVIEW_QUEUE',
            target_type: 'CLASSIFICATION',
            target_id: classification.id,
            reason: 'CUSTOMS_SEIZURE_DIRECT',
          });
          break;
        }

        case 'CUSTOMS_DOUBLE_CHECK': {
          if (classification.status === 'ADOPTED') {
            classification.status = 'SEALED';
            confidenceDelta = 0.3;
            classification.confidenceScore = this.bumpConfidence(
              classification.confidenceScore,
              0.3,
            );
            await clsRepo.save(classification);
            followUpActions.push({
              kind: 'STATUS_CHANGE',
              to: 'SEALED',
            });
            followUpActions.push({ kind: 'CONFIDENCE_BUMP', delta: 0.3 });
          }
          break;
        }
      }

      // 이벤트 저장
      const event = eventRepo.create({
        id: eventId,
        entId: ctx.entId,
        classificationId: classification.id,
        inquiryId: classification.inquiryId,
        eventType: dto.event_type,
        eventDate: new Date(dto.event_date),
        result: dto.result ?? null,
        confidenceDelta: confidenceDelta ? confidenceDelta.toFixed(3) : null,
        amountUsd: dto.amount_usd ? dto.amount_usd.toFixed(2) : null,
        notes: dto.notes ?? null,
        followUpActions,
        createdBy: ctx.userId,
      });
      await eventRepo.save(event);

      return { event, followUpActions };
    });

    // 감사 로그
    await this.auditLog.record({
      entId: ctx.entId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: 'CREATE',
      targetTable: 'hsc_verification_events',
      targetId: result.event.id,
      diff: {
        event_type: dto.event_type,
        result: dto.result ?? null,
        classification_id: classification.id,
        follow_up_count: result.followUpActions.length,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Phase 6 연동 — CUSTOMS_SEIZURE 발생 시 자동 에스컬레이션 호출
    if (dto.event_type === 'CUSTOMS_SEIZURE') {
      try {
        const escalationResult = await this.escalation.checkAndTriggerOnConfirm({
          entId: ctx.entId,
          userId: ctx.userId,
          userEmail: ctx.userEmail,
          classificationId: classification.id,
          amountUsd: dto.amount_usd,
        });
        if (escalationResult.triggered) {
          result.followUpActions.push({
            kind: 'EXPERT_REVIEW_AUTO',
            review_ids: escalationResult.createdReviews.map((r) => r.id),
            triggers: escalationResult.triggers.map((t) => t.reason),
          });
        }
      } catch (err) {
        this.logger.warn(
          `Auto-escalation after CUSTOMS_SEIZURE failed: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    return result;
  }

  async list(
    entId: string,
    classificationId?: string,
  ): Promise<VerificationEventEntity[]> {
    const qb = this.eventRepo
      .createQueryBuilder('v')
      .where('v.entId = :ent', { ent: entId })
      .andWhere('v.deletedAt IS NULL')
      .orderBy('v.eventDate', 'DESC')
      .addOrderBy('v.createdAt', 'DESC');
    if (classificationId) {
      qb.andWhere('v.classificationId = :cls', { cls: classificationId });
    }
    return qb.getMany();
  }

  // ----- ReviewQueue -----

  async listReviewQueue(
    entId: string,
    onlyOpen = true,
  ): Promise<ReviewQueueEntity[]> {
    const qb = this.queueRepo
      .createQueryBuilder('q')
      .where('q.entId = :ent', { ent: entId })
      .orderBy('q.priority', 'ASC')
      .addOrderBy('q.createdAt', 'DESC');
    if (onlyOpen) {
      qb.andWhere('q.resolvedAt IS NULL');
    }
    return qb.getMany();
  }

  async resolveQueueItem(
    entId: string,
    userId: string | null,
    id: string,
    notes?: string,
  ): Promise<ReviewQueueEntity> {
    const item = await this.queueRepo.findOne({ where: { id, entId } });
    if (!item) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `ReviewQueue item not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    item.resolvedAt = new Date();
    item.resolvedBy = userId;
    if (notes !== undefined) item.notes = notes;
    return this.queueRepo.save(item);
  }

  /**
   * 큐 항목별 요약 (HS 코드 / 품명) 보강 — FE 표시용
   */
  async fetchQueueSummaries(
    entId: string,
    items: ReviewQueueEntity[],
  ): Promise<
    Map<string, { hsCode?: string; itemName?: string; inquiryId?: string }>
  > {
    const result = new Map<
      string,
      { hsCode?: string; itemName?: string; inquiryId?: string }
    >();
    const clsIds = items
      .filter((q) => q.targetType === 'CLASSIFICATION')
      .map((q) => q.targetId);
    const itemIds = items
      .filter((q) => q.targetType === 'ITEM')
      .map((q) => q.targetId);

    if (clsIds.length > 0) {
      const cls = await this.classificationRepo
        .createQueryBuilder('c')
        .leftJoin(ItemEntity, 'it', 'it.id = c.itemId')
        .where('c.id IN (:...ids)', { ids: clsIds })
        .andWhere('c.entId = :ent', { ent: entId })
        .select([
          'c.id AS id',
          'c.hsCode AS hsCode',
          'c.inquiryId AS inquiryId',
          'it.nameRaw AS itemName',
        ])
        .getRawMany();
      for (const r of cls) {
        result.set(r.id, {
          hsCode: r.hsCode,
          itemName: r.itemName ?? undefined,
          inquiryId: r.inquiryId ?? undefined,
        });
      }
    }
    if (itemIds.length > 0) {
      const items2 = await this.itemRepo.find({
        where: itemIds.map((id) => ({ id, entId })),
      });
      for (const it of items2) {
        result.set(it.id, {
          itemName: it.nameRaw,
          inquiryId: it.inquiryId ?? undefined,
        });
      }
    }
    return result;
  }

  // ----- private -----

  private assertResultMatchesType(
    type: VerificationEventType,
    result?: VerificationResult,
  ): void {
    if (type === 'SAMPLE_ANALYSIS' && !result) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: 'SAMPLE_ANALYSIS requires result (MATCH|MISMATCH)',
        },
        timestamp: new Date().toISOString(),
      });
    }
    if (type === 'SAMPLE_ANALYSIS' && result === 'CONFIRMED') {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: 'SAMPLE_ANALYSIS result must be MATCH or MISMATCH',
        },
        timestamp: new Date().toISOString(),
      });
    }
    if (type === 'CUSTOMS_DOUBLE_CHECK' && result && result !== 'CONFIRMED') {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: 'CUSTOMS_DOUBLE_CHECK result must be CONFIRMED',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private bumpConfidence(
    current: string | null | undefined,
    delta: number,
  ): string {
    const c = current ? Number(current) : 0.5;
    const next = Math.max(0, Math.min(1, c + delta));
    return next.toFixed(3);
  }
}
