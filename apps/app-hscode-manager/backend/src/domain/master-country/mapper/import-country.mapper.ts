import { ImportCountryEntity } from '../entity/import-country.entity';
import { ImportCountryResponse } from '../dto/response/import-country.response';

export class ImportCountryMapper {
  static toResponse(entity: ImportCountryEntity): ImportCountryResponse {
    return {
      id: entity.id,
      code: entity.code,
      nameKo: entity.nameKo,
      nameEn: entity.nameEn,
      nameVi: entity.nameVi,
      supportStatus: entity.supportStatus,
      adapterKey: entity.adapterKey,
      currencyCode: entity.currencyCode,
      defaultTariffCurrency: entity.defaultTariffCurrency,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ImportCountryEntity[]): ImportCountryResponse[] {
    return entities.map((e) => ImportCountryMapper.toResponse(e));
  }
}
