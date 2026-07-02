import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  ClassificationEntity,
  ClassificationStatus,
  RecommendationSource,
} from '../entity/classification.entity';
import { ClassificationCandidateEntity } from '../entity/classification-candidate.entity';
import { InquiryEntity } from '../../inquiry/entity/inquiry.entity';
import { ItemEntity } from '../../item/entity/item.entity';
import { ExporterEntity } from '../../master-exporter/entity/exporter.entity';
import {
  CandidateSnapshot,
  ConfirmClassificationRequest,
} from '../dto/request/confirm-classification.request';
import { ListClassificationsQuery } from '../dto/request/list-classifications.query';
import { PaginatedResult } from '../../../common/dto/pagination.dto';
import { HscodeErrorCode } from '../../../common/error-codes';
import { AuditLogService } from '../../audit-log/service/audit-log.service';
import {
  EscalationService,
  EscalationTriggerInfo,
} from '../../expert-review/service/escalation.service';

export interface ConfirmResult {
  classification: ClassificationEntity;
  candidates: ClassificationCandidateEntity[];
  superseded: ClassificationEntity | null;
  escalation: {
    triggered: boolean;
    triggers: EscalationTriggerInfo[];
    expertReviewIds: string[];
  };
}

const ALLOWED_STATUS_TRANSITIONS: Record<
  ClassificationStatus,
  ClassificationStatus[]
> = {
  PROPOSED: ['ADOPTED'],
  ADOPTED: ['SEALED', 'SUPERSEDED', 'DISPUTED'],
  SEALED: ['DISPUTED'],
  SUPERSEDED: [],
  DISPUTED: ['SUPERSEDED'],
};

@Injectable()
export class ClassificationService {
  constructor(
    @InjectRepository(ClassificationEntity)
    private readonly repo: Repository<ClassificationEntity>,
    @InjectRepository(ClassificationCandidateEntity)
    private readonly candidateRepo: Repository<ClassificationCandidateEntity>,
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepo: Repository<InquiryEntity>,
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    @InjectRepository(ExporterEntity)
    private readonly exporterRepo: Repository<ExporterEntity>,
    private readonly auditLog: AuditLogService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => EscalationService))
    private readonly escalation: EscalationService,
  ) {}

  /**
   * 컨펌 워크플로우 (FR-CO-01~05):
   * 1. Inquiry/Item ent 검증
   * 2. selected_hs_code 가 candidates 안에 있는지 검증
   * 3. (overwrite=false) 동일 키 중복 감지 → 409 + 기존 ID 반환
   * 4. (overwrite=true) 기존 ADOPTED → SUPERSEDED 처리
   * 5. 사유 입력 강제 — 과거 채택과 다른 선택 시 selection_rationale 필수
   * 6. Classification + Candidate N개 트랜잭션 저장
   * 7. Inquiry 상태 → RESPONDED
   * 8. AuditLog 기록
   */
  async confirm(
    entId: string,
    userId: string | null,
    userEmail: string | null,
    ip: string | null,
    userAgent: string | null,
    dto: ConfirmClassificationRequest,
  ): Promise<ConfirmResult> {
    const inquiry = await this.inquiryRepo.findOne({
      where: { id: dto.inquiry_id, entId },
    });
    if (!inquiry) {
      throw new NotFoundException(
        this.errBody('Inquiry not found', HscodeErrorCode.INTERNAL_ERROR),
      );
    }
    const item = await this.itemRepo.findOne({
      where: { id: dto.item_id, entId },
    });
    if (!item) {
      throw new NotFoundException(
        this.errBody('Item not found', HscodeErrorCode.INTERNAL_ERROR),
      );
    }

    const selectedCandidate = dto.candidates.find(
      (c) => c.hs_code === dto.selected_hs_code,
    );
    if (!selectedCandidate) {
      throw new BadRequestException(
        this.errBody(
          'selected_hs_code must be one of the provided candidates',
          HscodeErrorCode.CLASSIFICATION_RATIONALE_REQUIRED,
        ),
      );
    }

    // 과거 채택과 다른 선택 → 사유 입력 강제 (FR-CO-02)
    const lastAdoption = await this.findLastAdoption(
      entId,
      inquiry.exporterId,
      inquiry.importCountryCode,
      item.compositionHash,
    );
    if (
      lastAdoption &&
      lastAdoption.hsCode !== dto.selected_hs_code &&
      (!dto.selection_rationale || dto.selection_rationale.trim().length === 0)
    ) {
      throw new BadRequestException(
        this.errBody(
          'selection_rationale is required when selecting a different code from past adoption',
          HscodeErrorCode.CLASSIFICATION_RATIONALE_REQUIRED,
          {
            past_hs_code: lastAdoption.hsCode,
            past_adopted_at: lastAdoption.adoptedAt?.toISOString() ?? null,
          },
        ),
      );
    }

    // 중복 감지 (X6): 동일 (exporter, import, hash, submitted_date)
    const existing = await this.findExistingDuplicate(
      entId,
      inquiry.exporterId,
      inquiry.importCountryCode,
      item.compositionHash,
      inquiry.submittedAt,
    );
    if (existing && !dto.overwrite_existing) {
      throw new ConflictException(
        this.errBody(
          'A classification with same (exporter, import, hash, date) already exists',
          HscodeErrorCode.CLASSIFICATION_DUPLICATE,
          {
            existing_id: existing.id,
            existing_hs_code: existing.hsCode,
            existing_adopted_at: existing.adoptedAt?.toISOString() ?? null,
          },
        ),
      );
    }

    // 트랜잭션 저장
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ClassificationEntity);
      const candRepo = manager.getRepository(ClassificationCandidateEntity);
      const inquiryRepoTx = manager.getRepository(InquiryEntity);

      const newId = uuid();
      const now = new Date();

      // supersede 처리
      let superseded: ClassificationEntity | null = null;
      if (existing && dto.overwrite_existing) {
        this.assertStatusTransition(existing.status, 'SUPERSEDED');
        existing.status = 'SUPERSEDED';
        existing.supersededAt = now;
        existing.supersededById = newId;
        superseded = await repo.save(existing);
      }

      // recommendation_source 추론
      const sources = new Set(dto.candidates.map((c) => c.source));
      const recoSource: RecommendationSource =
        sources.size > 1 ? 'MIXED' : (Array.from(sources)[0] ?? 'AI');

      const newClassification = repo.create({
        id: newId,
        entId,
        inquiryId: inquiry.id,
        itemId: item.id,
        hsCode: selectedCandidate.hs_code,
        basicTariffRate:
          selectedCandidate.basic_tariff_rate !== undefined &&
          selectedCandidate.basic_tariff_rate !== null
            ? selectedCandidate.basic_tariff_rate.toFixed(3)
            : null,
        ftaTariffRate:
          selectedCandidate.fta_tariff_rate !== undefined &&
          selectedCandidate.fta_tariff_rate !== null
            ? selectedCandidate.fta_tariff_rate.toFixed(3)
            : null,
        ftaAgreementCode: selectedCandidate.fta_agreement_code ?? null,
        confidenceScore: selectedCandidate.confidence.toFixed(3),
        status: 'ADOPTED' as ClassificationStatus,
        recommendationSource: recoSource,
        aiReasoning:
          dto.candidates.find((c) => c.source === 'AI' || c.source === 'MIXED')
            ?.reasoning ?? null,
        aiModelVersion: dto.ai_model_version ?? null,
        externalSources: dto.candidates
          .filter((c) => c.source_citations?.length)
          .map((c) => ({
            hs_code: c.hs_code,
            citations: c.source_citations,
            adapter_keys: c.external_adapter_keys,
          })),
        selectionRationale: dto.selection_rationale ?? null,
        adoptedAt: now,
        createdBy: userId,
      });
      const saved = await repo.save(newClassification);

      // 후보 N개 저장
      const candidateEntities = dto.candidates.map((c) =>
        this.toCandidateEntity(entId, saved.id, c),
      );
      await candRepo.save(candidateEntities);

      // Inquiry 상태 → RESPONDED
      if (inquiry.status !== 'RESPONDED') {
        inquiry.status = 'RESPONDED';
        await inquiryRepoTx.save(inquiry);
      }

      return {
        classification: saved,
        candidates: candidateEntities,
        superseded,
      };
    });

    // 감사 로그
    await this.auditLog.record({
      entId,
      userId,
      userEmail,
      action: 'CONFIRM',
      targetTable: 'hsc_classifications',
      targetId: result.classification.id,
      diff: {
        hs_code: result.classification.hsCode,
        selection_rationale: dto.selection_rationale ?? null,
        superseded_id: result.superseded?.id ?? null,
      },
      ip,
      userAgent,
    });
    if (result.superseded) {
      await this.auditLog.record({
        entId,
        userId,
        userEmail,
        action: 'SUPERSEDE',
        targetTable: 'hsc_classifications',
        targetId: result.superseded.id,
        diff: { superseded_by_id: result.classification.id },
        ip,
        userAgent,
      });
    }

    // Phase 6 — 자동 에스컬레이션 트리거 검사 (commit 후 실행)
    const escalationResult = await this.escalation.checkAndTriggerOnConfirm({
      entId,
      userId,
      userEmail,
      classificationId: result.classification.id,
    });

    return {
      ...result,
      escalation: {
        triggered: escalationResult.triggered,
        triggers: escalationResult.triggers,
        expertReviewIds: escalationResult.createdReviews.map((r) => r.id),
      },
    };
  }

  async findById(entId: string, id: string): Promise<ClassificationEntity> {
    const e = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!e) {
      throw new NotFoundException(
        this.errBody(`Classification not found: ${id}`, HscodeErrorCode.INTERNAL_ERROR),
      );
    }
    return e;
  }

  async getDetail(
    entId: string,
    id: string,
  ): Promise<{
    classification: ClassificationEntity;
    candidates: ClassificationCandidateEntity[];
    inquiry: InquiryEntity | null;
    item: ItemEntity | null;
    exporter: ExporterEntity | null;
    history: ClassificationEntity[];
  }> {
    const cls = await this.findById(entId, id);
    const candidates = await this.candidateRepo.find({
      where: { entId, classificationId: id },
      order: { ranking: 'ASC' },
    });
    const inquiry = await this.inquiryRepo.findOne({
      where: { id: cls.inquiryId, entId },
    });
    const item = await this.itemRepo.findOne({
      where: { id: cls.itemId, entId },
    });
    const exporter =
      inquiry?.exporterId
        ? await this.exporterRepo.findOne({
            where: { id: inquiry.exporterId, entId },
          })
        : null;

    // supersede 체인 추적
    const history = await this.repo.find({
      where: { itemId: cls.itemId, entId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    return { classification: cls, candidates, inquiry, item, exporter, history };
  }

  async findAll(
    entId: string,
    query: ListClassificationsQuery,
  ): Promise<PaginatedResult<ClassificationEntity>> {
    const qb = this.repo
      .createQueryBuilder('c')
      .innerJoin(InquiryEntity, 'inq', 'inq.id = c.inquiryId')
      .innerJoin(ItemEntity, 'it', 'it.id = c.itemId')
      .where('c.entId = :ent', { ent: entId })
      .andWhere('c.deletedAt IS NULL')
      .orderBy('c.createdAt', 'DESC');

    if (query.exporter_id)
      qb.andWhere('inq.exporterId = :ex', { ex: query.exporter_id });
    if (query.import_country)
      qb.andWhere('inq.importCountryCode = :ic', { ic: query.import_country });
    if (query.export_country)
      qb.andWhere('inq.exportCountryCode = :ec', { ec: query.export_country });
    if (query.hs_code) qb.andWhere('c.hsCode = :hs', { hs: query.hs_code });
    if (query.category) qb.andWhere('it.category = :cat', { cat: query.category });
    if (query.status) qb.andWhere('c.status = :st', { st: query.status });
    if (query.from) qb.andWhere('c.adoptedAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('c.adoptedAt <= :to', { to: query.to });
    if (query.q) qb.andWhere('it.nameRaw LIKE :q', { q: `%${query.q}%` });

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /**
   * 1순위 히트율 KPI (FR-QU-03) — Phase 7 대시보드 입력.
   * 컨펌된 분류에서 selected_hs_code 가 ranking=1 인 비율.
   */
  async computeRank1HitRate(entId: string, days = 90): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await this.repo
      .createQueryBuilder('c')
      .innerJoin(
        ClassificationCandidateEntity,
        'cnd',
        'cnd.classificationId = c.id AND cnd.hsCode = c.hsCode',
      )
      .where('c.entId = :ent', { ent: entId })
      .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
      .andWhere('c.adoptedAt >= :since', { since })
      .select(['c.id AS cls_id', 'cnd.ranking AS r'])
      .getRawMany();
    if (rows.length === 0) return 0;
    const rank1 = rows.filter((r) => Number(r.r) === 1).length;
    return Math.round((rank1 / rows.length) * 1000) / 1000;
  }

  // ----- helpers -----

  private async findLastAdoption(
    entId: string,
    exporterId: string | null,
    importCountryCode: string | null,
    compositionHash: string | null,
  ): Promise<ClassificationEntity | null> {
    if (!exporterId || !importCountryCode || !compositionHash) return null;
    return this.repo
      .createQueryBuilder('c')
      .innerJoin(InquiryEntity, 'inq', 'inq.id = c.inquiryId')
      .innerJoin(ItemEntity, 'it', 'it.id = c.itemId')
      .where('c.entId = :ent', { ent: entId })
      .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
      .andWhere('inq.exporterId = :ex', { ex: exporterId })
      .andWhere('inq.importCountryCode = :ic', { ic: importCountryCode })
      .andWhere('it.compositionHash = :h', { h: compositionHash })
      .andWhere('c.deletedAt IS NULL')
      .orderBy('c.adoptedAt', 'DESC')
      .getOne();
  }

  private async findExistingDuplicate(
    entId: string,
    exporterId: string | null,
    importCountryCode: string | null,
    compositionHash: string | null,
    submittedAt: Date | null,
  ): Promise<ClassificationEntity | null> {
    if (!exporterId || !importCountryCode || !compositionHash || !submittedAt)
      return null;
    // 동일 *날짜* 까지 묶어서 비교 (시간 무시)
    const dateOnly = new Date(submittedAt);
    dateOnly.setHours(0, 0, 0, 0);
    const next = new Date(dateOnly);
    next.setDate(next.getDate() + 1);
    return this.repo
      .createQueryBuilder('c')
      .innerJoin(InquiryEntity, 'inq', 'inq.id = c.inquiryId')
      .innerJoin(ItemEntity, 'it', 'it.id = c.itemId')
      .where('c.entId = :ent', { ent: entId })
      .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
      .andWhere('inq.exporterId = :ex', { ex: exporterId })
      .andWhere('inq.importCountryCode = :ic', { ic: importCountryCode })
      .andWhere('it.compositionHash = :h', { h: compositionHash })
      .andWhere('inq.submittedAt >= :d1 AND inq.submittedAt < :d2', {
        d1: dateOnly,
        d2: next,
      })
      .andWhere('c.deletedAt IS NULL')
      .getOne();
  }

  /**
   * 불변성 가드 — ADOPTED 이상 상태는 PROPOSED 로 못 돌아간다.
   */
  private assertStatusTransition(
    from: ClassificationStatus,
    to: ClassificationStatus,
  ): void {
    const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ForbiddenException(
        this.errBody(
          `Invalid status transition: ${from} → ${to}`,
          HscodeErrorCode.CLASSIFICATION_IMMUTABLE,
        ),
      );
    }
  }

  private toCandidateEntity(
    entId: string,
    classificationId: string,
    snap: CandidateSnapshot,
  ): ClassificationCandidateEntity {
    return this.candidateRepo.create({
      id: uuid(),
      entId,
      classificationId,
      hsCode: snap.hs_code,
      description: snap.description ?? null,
      basicTariffRate:
        snap.basic_tariff_rate !== undefined && snap.basic_tariff_rate !== null
          ? snap.basic_tariff_rate.toFixed(3)
          : null,
      ftaTariffRate:
        snap.fta_tariff_rate !== undefined && snap.fta_tariff_rate !== null
          ? snap.fta_tariff_rate.toFixed(3)
          : null,
      ftaAgreementCode: snap.fta_agreement_code ?? null,
      source: snap.source,
      ranking: snap.ranking,
      confidence: snap.confidence.toFixed(3),
      reasoning: snap.reasoning ?? null,
      sourceCitations: snap.source_citations ?? null,
      externalAdapterKeys: snap.external_adapter_keys ?? null,
      flags: snap.flags ?? null,
      pastAdoptionCount: snap.past_adoption_count ?? 0,
    });
  }

  private errBody(message: string, code: string, details?: unknown) {
    return {
      success: false,
      data: null,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
      timestamp: new Date().toISOString(),
    };
  }
}
