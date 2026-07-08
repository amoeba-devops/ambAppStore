import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GtinHsMap } from '../entity/gtin-hs-map.entity';

export interface Layer1Result {
  hit: boolean;
  hs6?: string;
  source?: string;
  confidence?: number | null;
}

/** FN-011 — Layer 1 직접 매핑 조회 (hsm_gtin_hs_maps). 적중 시 외부 호출 생략. */
@Injectable()
export class Layer1DirectMapService {
  constructor(
    @InjectRepository(GtinHsMap)
    private readonly gtinHsMapRepo: Repository<GtinHsMap>,
  ) {}

  async lookup(entId: string, gtin14: string): Promise<Layer1Result> {
    const row = await this.gtinHsMapRepo.findOne({
      where: { entId, gtin: gtin14, deletedAt: IsNull() },
    });
    if (!row) return { hit: false };
    return {
      hit: true,
      hs6: row.hs6,
      source: row.source,
      confidence: row.confidence != null ? Number(row.confidence) : null,
    };
  }
}
