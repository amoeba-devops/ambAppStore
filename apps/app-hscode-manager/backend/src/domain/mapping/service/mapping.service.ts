import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GtinHsMap } from '../../gtin/entity/gtin-hs-map.entity';
import { GpcHsMap } from '../entity/gpc-hs-map.entity';
import { HsCountryExtension } from '../entity/hs-country-extension.entity';
import {
  UpsertCountryExtRequest,
  UpsertGpcMapRequest,
  UpsertGtinMapRequest,
} from '../dto/request/upsert-map.request';

/** SCR-005 매핑 편집 (FR-043, source=MANUAL). GTIN map은 테넌트별, GPC/country-ext는 전역. */
@Injectable()
export class MappingService {
  constructor(
    @InjectRepository(GtinHsMap) private readonly gtinRepo: Repository<GtinHsMap>,
    @InjectRepository(GpcHsMap) private readonly gpcRepo: Repository<GpcHsMap>,
    @InjectRepository(HsCountryExtension) private readonly extRepo: Repository<HsCountryExtension>,
  ) {}

  // --- GTIN → HS6 (테넌트별) ---
  listGtin(entId: string): Promise<GtinHsMap[]> {
    return this.gtinRepo.find({ where: { entId }, order: { updatedAt: 'DESC' }, take: 100 });
  }

  async upsertGtin(entId: string, userId: string, dto: UpsertGtinMapRequest): Promise<GtinHsMap> {
    const existing = await this.gtinRepo.findOne({ where: { entId, gtin: dto.gtin } });
    const entity = existing ?? this.gtinRepo.create({ entId, gtin: dto.gtin });
    entity.hs6 = dto.hs6;
    entity.gpcBrick = dto.gpc_brick ?? entity.gpcBrick ?? null;
    entity.source = 'MANUAL';
    entity.verifiedBy = userId;
    return this.gtinRepo.save(entity);
  }

  // --- GPC Brick → HS6 (전역, 1:다) ---
  listGpc(): Promise<GpcHsMap[]> {
    return this.gpcRepo.find({ order: { gpcBrick: 'ASC' }, take: 200 });
  }

  async upsertGpc(dto: UpsertGpcMapRequest): Promise<GpcHsMap> {
    const existing = await this.gpcRepo.findOne({
      where: { gpcBrick: dto.gpc_brick, hs6: dto.hs6 },
    });
    const entity = existing ?? this.gpcRepo.create({ gpcBrick: dto.gpc_brick, hs6: dto.hs6 });
    entity.priority = dto.priority ?? entity.priority ?? 1;
    return this.gpcRepo.save(entity);
  }

  // --- HS6 → 국가 확장 (전역) ---
  listCountryExt(): Promise<HsCountryExtension[]> {
    return this.extRepo.find({ order: { hs6: 'ASC' }, take: 200 });
  }

  async upsertCountryExt(dto: UpsertCountryExtRequest): Promise<HsCountryExtension> {
    const country = dto.country.toUpperCase();
    const existing = await this.extRepo.findOne({ where: { hs6: dto.hs6, country } });
    const entity = existing ?? this.extRepo.create({ hs6: dto.hs6, country });
    entity.hsFull = dto.hs_full;
    entity.dutyRate = dto.duty_rate != null ? dto.duty_rate.toFixed(3) : entity.dutyRate ?? null;
    entity.description = dto.description ?? entity.description ?? null;
    return this.extRepo.save(entity);
  }

  /** 국가 확장 미리보기 — HS6에 대한 전 국가 코드/관세 (FR-017/043). */
  previewCountry(hs6: string): Promise<HsCountryExtension[]> {
    return this.extRepo.find({ where: { hs6 }, order: { country: 'ASC' } });
  }
}
