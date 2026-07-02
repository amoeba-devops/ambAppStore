import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemEntity } from '../../item/entity/item.entity';
import { ClassificationEntity } from '../../classification/entity/classification.entity';
import { InquiryEntity } from '../../inquiry/entity/inquiry.entity';

export interface InternalMatchInput {
  entId: string;
  itemId: string;
  exporterId: string | null;
  importCountryCode: string;
  /** 신선도 게이트 — 이 시점 이후의 채택만 통과 (기본 12개월) */
  freshnessMonths?: number;
}

export interface InternalCandidate {
  hsCode: string;
  confidence: number;
  source: 'EXPORTER_IMPORT' | 'IMPORT_ONLY' | 'FUZZY_NAME';
  pastAdoptionCount: number;
  lastAdoptedAt: string | null;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  hasDisputedHistory: boolean;
  reason: string;
}

export interface InternalMatchResult {
  candidates: InternalCandidate[];
  highConfidenceFresh: boolean; // true 면 외부·AI 호출 생략 가능
}

@Injectable()
export class InternalMatchingService {
  constructor(
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    @InjectRepository(ClassificationEntity)
    private readonly classificationRepo: Repository<ClassificationEntity>,
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepo: Repository<InquiryEntity>,
  ) {}

  async match(input: InternalMatchInput): Promise<InternalMatchResult> {
    const item = await this.itemRepo.findOne({
      where: { id: input.itemId, entId: input.entId },
    });
    if (!item) {
      return { candidates: [], highConfidenceFresh: false };
    }

    const cutoff = this.cutoffDate(input.freshnessMonths ?? 12);
    const candidates: InternalCandidate[] = [];

    // 1순위: 동일 exporter + 동일 import_country + 동일 hash
    if (input.exporterId && item.compositionHash) {
      const rows = await this.classificationRepo
        .createQueryBuilder('c')
        .innerJoin(InquiryEntity, 'inq', 'inq.id = c.inquiryId')
        .innerJoin(ItemEntity, 'it', 'it.id = c.itemId')
        .where('c.entId = :ent', { ent: input.entId })
        .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
        .andWhere('inq.exporterId = :exp', { exp: input.exporterId })
        .andWhere('inq.importCountryCode = :ic', { ic: input.importCountryCode })
        .andWhere('it.compositionHash = :h', { h: item.compositionHash })
        .andWhere('c.adoptedAt IS NOT NULL')
        .andWhere('c.deletedAt IS NULL')
        .orderBy('c.adoptedAt', 'DESC')
        .getMany();

      const grouped = this.groupByHsCode(rows);
      for (const [hs, group] of grouped) {
        candidates.push(
          this.toCandidate(group, hs, 'EXPORTER_IMPORT', 0.95, cutoff),
        );
      }
    }

    // 2순위: 동일 import_country + 동일 hash (다른 exporter 가능)
    if (item.compositionHash) {
      const rows = await this.classificationRepo
        .createQueryBuilder('c')
        .innerJoin(InquiryEntity, 'inq', 'inq.id = c.inquiryId')
        .innerJoin(ItemEntity, 'it', 'it.id = c.itemId')
        .where('c.entId = :ent', { ent: input.entId })
        .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
        .andWhere('inq.importCountryCode = :ic', { ic: input.importCountryCode })
        .andWhere('it.compositionHash = :h', { h: item.compositionHash })
        .andWhere('c.adoptedAt IS NOT NULL')
        .andWhere('c.deletedAt IS NULL')
        .orderBy('c.adoptedAt', 'DESC')
        .getMany();

      const seen = new Set(candidates.map((c) => c.hsCode));
      const grouped = this.groupByHsCode(rows);
      for (const [hs, group] of grouped) {
        if (seen.has(hs)) continue;
        candidates.push(this.toCandidate(group, hs, 'IMPORT_ONLY', 0.85, cutoff));
      }
    }

    // 3순위: 이름 정규화 fuzzy (간이 LIKE)
    if (item.nameNormalized) {
      const rows = await this.classificationRepo
        .createQueryBuilder('c')
        .innerJoin(InquiryEntity, 'inq', 'inq.id = c.inquiryId')
        .innerJoin(ItemEntity, 'it', 'it.id = c.itemId')
        .where('c.entId = :ent', { ent: input.entId })
        .andWhere('c.status IN (:...st)', { st: ['ADOPTED', 'SEALED'] })
        .andWhere('inq.importCountryCode = :ic', { ic: input.importCountryCode })
        .andWhere('it.nameNormalized LIKE :n', { n: `%${item.nameNormalized}%` })
        .andWhere('it.category = :cat', { cat: item.category })
        .andWhere('c.deletedAt IS NULL')
        .orderBy('c.adoptedAt', 'DESC')
        .limit(50)
        .getMany();

      const seen = new Set(candidates.map((c) => c.hsCode));
      const grouped = this.groupByHsCode(rows);
      for (const [hs, group] of grouped) {
        if (seen.has(hs)) continue;
        candidates.push(this.toCandidate(group, hs, 'FUZZY_NAME', 0.6, cutoff));
      }
    }

    // 신선도/위험도 게이트
    const top = candidates[0];
    const highConfidenceFresh =
      !!top &&
      top.confidence >= 0.85 &&
      top.source !== 'FUZZY_NAME' &&
      !top.hasDisputedHistory &&
      this.isFreshEnough(top.lastAdoptedAt, cutoff);

    return { candidates, highConfidenceFresh };
  }

  private groupByHsCode(
    rows: ClassificationEntity[],
  ): Map<string, ClassificationEntity[]> {
    const m = new Map<string, ClassificationEntity[]>();
    for (const r of rows) {
      const arr = m.get(r.hsCode) ?? [];
      arr.push(r);
      m.set(r.hsCode, arr);
    }
    return m;
  }

  private toCandidate(
    group: ClassificationEntity[],
    hsCode: string,
    source: InternalCandidate['source'],
    baseConfidence: number,
    cutoff: Date,
  ): InternalCandidate {
    const sorted = [...group].sort(
      (a, b) =>
        (b.adoptedAt?.getTime() ?? 0) - (a.adoptedAt?.getTime() ?? 0),
    );
    const latest = sorted[0];
    const hasDisputed = group.some((c) => c.status === 'DISPUTED');
    const fresh = this.isFreshEnough(
      latest.adoptedAt ? latest.adoptedAt.toISOString() : null,
      cutoff,
    );

    let conf = baseConfidence;
    if (!fresh) conf -= 0.15;
    if (hasDisputed) conf -= 0.2;
    conf += Math.min(0.05, (group.length - 1) * 0.01); // 채택 빈도 가산
    conf = Math.max(0.1, Math.min(0.99, conf));

    const tariff = latest.basicTariffRate ? Number(latest.basicTariffRate) : null;
    const fta = latest.ftaTariffRate ? Number(latest.ftaTariffRate) : null;

    return {
      hsCode,
      confidence: Math.round(conf * 1000) / 1000,
      source,
      pastAdoptionCount: group.length,
      lastAdoptedAt: latest.adoptedAt ? latest.adoptedAt.toISOString() : null,
      basicTariffRate: tariff,
      ftaTariffRate: fta,
      hasDisputedHistory: hasDisputed,
      reason: `Past adoption x${group.length}` + (hasDisputed ? ' (with disputed history)' : ''),
    };
  }

  private isFreshEnough(iso: string | null, cutoff: Date): boolean {
    if (!iso) return false;
    return new Date(iso).getTime() >= cutoff.getTime();
  }

  private cutoffDate(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }
}
