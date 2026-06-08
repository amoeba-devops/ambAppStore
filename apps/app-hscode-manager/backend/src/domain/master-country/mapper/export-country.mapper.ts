import { ExportCountryEntity } from '../entity/export-country.entity';
import { ExportCountryResponse } from '../dto/response/export-country.response';

export class ExportCountryMapper {
  static toResponse(entity: ExportCountryEntity): ExportCountryResponse {
    return {
      id: entity.id,
      code: entity.code,
      nameKo: entity.nameKo,
      nameEn: entity.nameEn,
      nameVi: entity.nameVi,
      isActive: entity.isActive === 1,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ExportCountryEntity[]): ExportCountryResponse[] {
    return entities.map((e) => ExportCountryMapper.toResponse(e));
  }
}
