import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HsCountryExtension } from '../../mapping/entity/hs-country-extension.entity';

export interface CountryExpansion {
  hsFull: string | null;
  dutyRate: number | null;
  description: string | null;
  available: boolean;
}

/** FN-015 — HS6 → 국가별 8~10자리 + 관세율 확장 (hsm_hs_country_extensions). */
@Injectable()
export class CountryExpanderService {
  constructor(
    @InjectRepository(HsCountryExtension)
    private readonly extRepo: Repository<HsCountryExtension>,
  ) {}

  async expand(hs6: string, country: string): Promise<CountryExpansion> {
    const row = await this.extRepo.findOne({ where: { hs6, country } });
    if (!row) {
      return { hsFull: null, dutyRate: null, description: null, available: false };
    }
    return {
      hsFull: row.hsFull,
      dutyRate: row.dutyRate != null ? Number(row.dutyRate) : null,
      description: row.description,
      available: true,
    };
  }
}
