import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationEventEntity } from '../entity/verification-event.entity';
import { ClassificationEntity } from '../../classification/entity/classification.entity';
import { KpiSummary } from '../dto/response/verification-event.response';

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(VerificationEventEntity)
    private readonly eventRepo: Repository<VerificationEventEntity>,
    @InjectRepository(ClassificationEntity)
    private readonly clsRepo: Repository<ClassificationEntity>,
  ) {}

  /**
   * 최근 N개월 KPI 집계 (FR-VR-03):
   *   - 추징률 = CUSTOMS_SEIZURE 건수 / 총 ADOPTED 건수
   *   - 정정률 = SUPERSEDED 건수 / 총 ADOPTED 건수
   *   - 세관확인률 = SEALED 건수 / 총 ADOPTED 건수
   */
  async summary(entId: string, periodMonths = 1): Promise<KpiSummary> {
    const since = new Date();
    since.setMonth(since.getMonth() - periodMonths);

    const [adoptedTotal, supersededTotal, sealedTotal, disputedTotal] =
      await Promise.all([
        this.clsRepo.count({
          where: { entId, status: 'ADOPTED' as const },
        }),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.status = :st', { st: 'SUPERSEDED' })
          .andWhere('c.supersededAt >= :since', { since })
          .getCount(),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.status = :st', { st: 'SEALED' })
          .andWhere('c.updatedAt >= :since', { since })
          .getCount(),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.status = :st', { st: 'DISPUTED' })
          .andWhere('c.updatedAt >= :since', { since })
          .getCount(),
      ]);

    const seizureRows = await this.eventRepo
      .createQueryBuilder('v')
      .where('v.entId = :ent', { ent: entId })
      .andWhere('v.eventType = :t', { t: 'CUSTOMS_SEIZURE' })
      .andWhere('v.eventDate >= :since', { since })
      .andWhere('v.deletedAt IS NULL')
      .getMany();
    const totalSeizure = seizureRows.length;
    const totalSeizureAmountUsd = seizureRows.reduce(
      (sum, r) => sum + (r.amountUsd ? Number(r.amountUsd) : 0),
      0,
    );

    const totalSampleAnalysis = await this.eventRepo
      .createQueryBuilder('v')
      .where('v.entId = :ent', { ent: entId })
      .andWhere('v.eventType = :t', { t: 'SAMPLE_ANALYSIS' })
      .andWhere('v.eventDate >= :since', { since })
      .andWhere('v.deletedAt IS NULL')
      .getCount();

    const denom = Math.max(1, adoptedTotal);
    const round = (n: number) => Math.round(n * 10000) / 10000;

    return {
      periodMonths,
      totalAdopted: adoptedTotal,
      totalSuperseded: supersededTotal,
      totalSealed: sealedTotal,
      totalDisputed: disputedTotal,
      totalSeizure,
      totalSampleAnalysis,
      seizureRate: round(totalSeizure / denom),
      correctionRate: round(supersededTotal / denom),
      sealedRate: round(sealedTotal / denom),
      totalSeizureAmountUsd: round(totalSeizureAmountUsd),
    };
  }
}
