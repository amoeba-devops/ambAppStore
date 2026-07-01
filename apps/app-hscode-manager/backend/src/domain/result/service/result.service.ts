import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLog } from '../../search-qa/entity/query-log.entity';
import { HsReference } from '../../reference/entity/hs-reference.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import {
  CitationResponse,
  ResultDetailResponse,
} from '../dto/response/result-detail.response';

/** SCR-004 — 3모드 공통 결과 상세 + 근거 출처 (FR-006/020/041/042). */
@Injectable()
export class ResultService {
  constructor(
    @InjectRepository(QueryLog)
    private readonly queryLogRepo: Repository<QueryLog>,
    @InjectRepository(HsReference)
    private readonly hsReferenceRepo: Repository<HsReference>,
  ) {}

  async getDetail(entId: string, logId: string): Promise<ResultDetailResponse> {
    const log = await this.queryLogRepo.findOne({ where: { qlgId: logId, entId } });
    if (!log) {
      throw new BusinessException(
        ERROR_CODES.NO_CANDIDATE,
        'Result not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const hsCode = log.resultHs ?? '';
    const ref = log.hsReferenceId
      ? await this.hsReferenceRepo.findOne({ where: { hsrId: log.hsReferenceId, entId } })
      : await this.hsReferenceRepo.findOne({ where: { entId, hsCode } });

    const citations = await this.loadCitations(entId, hsCode);

    return {
      logId: log.qlgId,
      mode: log.mode,
      hsCode,
      hs6: this.toHs6(hsCode),
      description: ref?.description ?? null,
      origin: ref?.origin ?? null,
      unit: ref?.unit ?? null,
      tradeType: ref?.tradeType ?? null,
      confidence: log.confidence != null ? Number(log.confidence) : null,
      source: 'REFERENCE',
      verifier: log.userId,
      recordedAt: log.createdAt?.toISOString(),
      citations,
    };
  }

  private async loadCitations(entId: string, hsCode: string): Promise<CitationResponse[]> {
    if (!hsCode) return [];
    const rows = await this.hsReferenceRepo
      .createQueryBuilder('r')
      .select('r.hsr_source_company', 'company')
      .addSelect('r.hsr_description', 'description')
      .addSelect('r.hsr_hs_code', 'hsCode')
      .addSelect('COUNT(*)::int', 'count')
      .where('r.ent_id = :entId', { entId })
      .andWhere('r.hsr_hs_code = :hsCode', { hsCode })
      .andWhere('r.hsr_deleted_at IS NULL')
      .groupBy('r.hsr_source_company')
      .addGroupBy('r.hsr_description')
      .addGroupBy('r.hsr_hs_code')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<CitationResponse>();
    return rows;
  }

  private toHs6(hsCode: string): string {
    return (hsCode ?? '').replace(/\D/g, '').slice(0, 6);
  }
}
