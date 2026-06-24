import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassificationEntity } from '../../classification/entity/classification.entity';
import { ClassificationCandidateEntity } from '../../classification/entity/classification-candidate.entity';
import { VerificationEventEntity } from '../../verification/entity/verification-event.entity';
import { AiRecommendationLogEntity } from '../../external/entity/ai-recommendation-log.entity';

export interface AdminKpiDashboard {
  periodMonths: number;
  /** Phase 4 — 1순위 히트율 (rank=1 컨펌 비율) */
  rank1HitRate: number;
  /** Phase 5 — 추징률 */
  seizureRate: number;
  /** Phase 5 — 정정률 (SUPERSEDED 비율) */
  correctionRate: number;
  /** Phase 5 — 세관확인률 (SEALED 비율) */
  sealedRate: number;
  /** Phase 3 — AI 운영 지표 */
  ai: {
    totalCalls: number;
    okRate: number;
    hallucinationRate: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  };
  /** 누적 통계 */
  totals: {
    inquiries: number;
    classifications: number;
    adopted: number;
    sealed: number;
    superseded: number;
    disputed: number;
    seizureEvents: number;
    seizureAmountUsd: number;
  };
  /** 월별 추세 (최근 6개월) */
  monthlyTrend: Array<{
    yearMonth: string;
    adopted: number;
    superseded: number;
    sealed: number;
    seizureCount: number;
  }>;
}

@Injectable()
export class AdminKpiService {
  constructor(
    @InjectRepository(ClassificationEntity)
    private readonly clsRepo: Repository<ClassificationEntity>,
    @InjectRepository(ClassificationCandidateEntity)
    private readonly candidateRepo: Repository<ClassificationCandidateEntity>,
    @InjectRepository(VerificationEventEntity)
    private readonly verRepo: Repository<VerificationEventEntity>,
    @InjectRepository(AiRecommendationLogEntity)
    private readonly aiRepo: Repository<AiRecommendationLogEntity>,
  ) {}

  async dashboard(entId: string, periodMonths = 6): Promise<AdminKpiDashboard> {
    const since = new Date();
    since.setMonth(since.getMonth() - periodMonths);

    // 1순위 히트율
    const allRanks = await this.candidateRepo
      .createQueryBuilder('cnd')
      .innerJoin(
        ClassificationEntity,
        'c',
        'c.id = cnd.classificationId AND cnd.hsCode = c.hsCode',
      )
      .where('c.entId = :ent', { ent: entId })
      .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
      .andWhere('c.adoptedAt >= :since', { since })
      .select(['cnd.ranking AS r'])
      .getRawMany();
    const rank1HitRate = allRanks.length
      ? Math.round(
          (allRanks.filter((r) => Number(r.r) === 1).length / allRanks.length) *
            10000,
        ) / 10000
      : 0;

    const [totalAdopted, totalSuperseded, totalSealed, totalDisputed] =
      await Promise.all([
        this.clsRepo.count({ where: { entId, status: 'ADOPTED' as const } }),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.status = :s', { s: 'SUPERSEDED' })
          .andWhere('c.supersededAt >= :since', { since })
          .getCount(),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.status = :s', { s: 'SEALED' })
          .andWhere('c.updatedAt >= :since', { since })
          .getCount(),
        this.clsRepo.count({ where: { entId, status: 'DISPUTED' as const } }),
      ]);

    const seizureRows = await this.verRepo
      .createQueryBuilder('v')
      .where('v.entId = :ent', { ent: entId })
      .andWhere('v.eventType = :t', { t: 'CUSTOMS_SEIZURE' })
      .andWhere('v.eventDate >= :since', { since })
      .andWhere('v.deletedAt IS NULL')
      .getMany();

    const denom = Math.max(1, totalAdopted);
    const round = (n: number) => Math.round(n * 10000) / 10000;
    const seizureRate = round(seizureRows.length / denom);
    const correctionRate = round(totalSuperseded / denom);
    const sealedRate = round(totalSealed / denom);

    // AI 지표
    const aiLogs = await this.aiRepo
      .createQueryBuilder('a')
      .where('a.entId = :ent', { ent: entId })
      .andWhere('a.createdAt >= :since', { since })
      .getMany();
    const totalCalls = aiLogs.length;
    const ok = aiLogs.filter((a) => a.status === 'OK').length;
    const hallucinated = aiLogs.filter((a) => (a.hallucinatedCount ?? 0) > 0).length;
    const avgLatency = totalCalls
      ? Math.round(
          aiLogs.reduce((s, a) => s + (a.latencyMs ?? 0), 0) / totalCalls,
        )
      : 0;
    const totalCost = round(
      aiLogs.reduce((s, a) => s + (a.costUsd ? Number(a.costUsd) : 0), 0),
    );

    // 월별 추세 (최근 6개월)
    const monthlyTrend = await this.computeMonthlyTrend(entId, periodMonths);

    return {
      periodMonths,
      rank1HitRate,
      seizureRate,
      correctionRate,
      sealedRate,
      ai: {
        totalCalls,
        okRate: totalCalls ? round(ok / totalCalls) : 0,
        hallucinationRate: totalCalls ? round(hallucinated / totalCalls) : 0,
        avgLatencyMs: avgLatency,
        totalCostUsd: totalCost,
      },
      totals: {
        inquiries: 0, // 별도 inquiry repo 주입 시 채울 수 있음 — Phase 7 MVP 에서는 0
        classifications: totalAdopted + totalSuperseded + totalSealed + totalDisputed,
        adopted: totalAdopted,
        sealed: totalSealed,
        superseded: totalSuperseded,
        disputed: totalDisputed,
        seizureEvents: seizureRows.length,
        seizureAmountUsd: round(
          seizureRows.reduce(
            (s, r) => s + (r.amountUsd ? Number(r.amountUsd) : 0),
            0,
          ),
        ),
      },
      monthlyTrend,
    };
  }

  private async computeMonthlyTrend(
    entId: string,
    months: number,
  ): Promise<AdminKpiDashboard['monthlyTrend']> {
    const result: AdminKpiDashboard['monthlyTrend'] = [];
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const [adopted, superseded, sealed, seizureCount] = await Promise.all([
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.adoptedAt >= :s AND c.adoptedAt < :e', { s: start, e: end })
          .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
          .getCount(),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.supersededAt >= :s AND c.supersededAt < :e', {
            s: start,
            e: end,
          })
          .getCount(),
        this.clsRepo
          .createQueryBuilder('c')
          .where('c.entId = :ent', { ent: entId })
          .andWhere('c.status = :s', { s: 'SEALED' })
          .andWhere('c.updatedAt >= :st AND c.updatedAt < :e', {
            st: start,
            e: end,
          })
          .getCount(),
        this.verRepo
          .createQueryBuilder('v')
          .where('v.entId = :ent', { ent: entId })
          .andWhere('v.eventType = :t', { t: 'CUSTOMS_SEIZURE' })
          .andWhere('v.eventDate >= :s AND v.eventDate < :e', {
            s: start,
            e: end,
          })
          .getCount(),
      ]);

      const ym = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        yearMonth: ym,
        adopted,
        superseded,
        sealed,
        seizureCount,
      });
    }
    return result;
  }
}
