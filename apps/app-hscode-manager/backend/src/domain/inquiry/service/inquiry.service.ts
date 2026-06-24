import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { InquiryEntity, InquiryStatus } from '../entity/inquiry.entity';
import { CreateInquiryRequest } from '../dto/request/create-inquiry.request';
import { InquiryStatusValue } from '../dto/request/update-inquiry-status.request';
import { ListInquiriesQuery } from '../dto/request/list-inquiries.query';
import { PaginatedResult } from '../../../common/dto/pagination.dto';
import { HscodeErrorCode } from '../../../common/error-codes';
import { ImportCountryService } from '../../master-country/service/import-country.service';

/**
 * 상태 전이 그래프.
 * key = 현재 상태, value = 허용된 다음 상태들.
 */
const ALLOWED_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  DRAFT: ['INTAKE'],
  INTAKE: ['MATCHING', 'DRAFT'],
  MATCHING: ['REVIEWING', 'RESPONDED'],
  REVIEWING: ['MATCHING', 'RESPONDED'],
  RESPONDED: ['VERIFIED', 'DISPUTED'],
  VERIFIED: ['DISPUTED'],
  DISPUTED: [],
};

export interface CreateInquiryResult {
  entity: InquiryEntity;
  warnings: string[];
}

@Injectable()
export class InquiryService {
  constructor(
    @InjectRepository(InquiryEntity)
    private readonly repo: Repository<InquiryEntity>,
    private readonly importCountryService: ImportCountryService,
  ) {}

  async findAll(
    entId: string,
    query: ListInquiriesQuery,
  ): Promise<PaginatedResult<InquiryEntity>> {
    const qb = this.repo
      .createQueryBuilder('i')
      .where('i.entId = :entId', { entId })
      .andWhere('i.deletedAt IS NULL')
      .orderBy('i.createdAt', 'DESC');

    if (query.exporter_id) {
      qb.andWhere('i.exporterId = :ex', { ex: query.exporter_id });
    }
    if (query.import_country) {
      qb.andWhere('i.importCountryCode = :ic', { ic: query.import_country });
    }
    if (query.status) {
      qb.andWhere('i.status = :st', { st: query.status });
    }

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findById(entId: string, id: string): Promise<InquiryEntity> {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Inquiry not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  /**
   * 신규 Inquiry 생성.
   * - 수입국 NOT_SUPPORTED → 거부 (HSC-E0301)
   * - 수입국 BETA → 생성 허용 + warnings: ['beta_country']
   * - 수입국 ACTIVE → 정상
   */
  async create(
    entId: string,
    userId: string | undefined,
    dto: CreateInquiryRequest,
  ): Promise<CreateInquiryResult> {
    const ic = await this.importCountryService.findByCode(
      dto.import_country_code.toUpperCase(),
    );
    if (!ic) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INQUIRY_NOT_SUPPORTED_COUNTRY,
          message: `Unknown import country: ${dto.import_country_code}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    if (ic.supportStatus === 'NOT_SUPPORTED') {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INQUIRY_NOT_SUPPORTED_COUNTRY,
          message: `Import country ${ic.code} is not supported yet`,
          details: { code: ic.code, support_status: ic.supportStatus },
        },
        timestamp: new Date().toISOString(),
      });
    }

    const warnings: string[] = [];
    if (ic.supportStatus === 'BETA') {
      warnings.push('beta_country');
    }

    const entity = this.repo.create({
      id: uuid(),
      entId,
      exporterId: dto.exporter_id,
      exportCountryCode: dto.export_country_code.toUpperCase(),
      importCountryCode: ic.code,
      title: dto.title ?? null,
      memo: dto.memo ?? null,
      status: 'DRAFT' as InquiryStatus,
      submittedAt: new Date(),
      createdBy: userId ?? null,
    });
    const saved = await this.repo.save(entity);
    return { entity: saved, warnings };
  }

  async updateStatus(
    entId: string,
    id: string,
    next: InquiryStatusValue,
  ): Promise<InquiryEntity> {
    const entity = await this.findById(entId, id);
    const allowed = ALLOWED_TRANSITIONS[entity.status] ?? [];
    if (!allowed.includes(next as InquiryStatus)) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INQUIRY_INVALID_STATUS_TRANSITION,
          message: `Invalid status transition: ${entity.status} → ${next}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    entity.status = next as InquiryStatus;
    return this.repo.save(entity);
  }

  async setCompletenessScore(
    entId: string,
    id: string,
    score: number,
  ): Promise<void> {
    const entity = await this.findById(entId, id);
    entity.completenessScore = score.toFixed(3);
    await this.repo.save(entity);
  }

  async softDelete(entId: string, id: string): Promise<void> {
    const entity = await this.findById(entId, id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }
}
