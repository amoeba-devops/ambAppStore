import { ExporterEntity } from '../entity/exporter.entity';
import { ExporterResponse } from '../dto/response/exporter.response';

export class ExporterMapper {
  static toResponse(entity: ExporterEntity): ExporterResponse {
    return {
      id: entity.id,
      name: entity.name,
      countryCode: entity.countryCode,
      aliases: entity.aliases ?? [],
      riskFlags: entity.riskFlags,
      memo: entity.memo,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ExporterEntity[]): ExporterResponse[] {
    return entities.map((e) => ExporterMapper.toResponse(e));
  }
}
