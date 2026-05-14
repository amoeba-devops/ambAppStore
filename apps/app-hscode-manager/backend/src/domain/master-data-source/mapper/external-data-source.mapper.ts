import { ExternalDataSourceEntity } from '../entity/external-data-source.entity';
import { ExternalDataSourceResponse } from '../dto/response/external-data-source.response';

export class ExternalDataSourceMapper {
  static toResponse(entity: ExternalDataSourceEntity): ExternalDataSourceResponse {
    return {
      id: entity.id,
      adapterKey: entity.adapterKey,
      importCountryCode: entity.importCountryCode,
      displayName: entity.displayName,
      endpointUrl: entity.endpointUrl,
      cacheTtlSec: entity.cacheTtlSec,
      isActive: entity.isActive === 1,
      priority: entity.priority,
      config: entity.config,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ExternalDataSourceEntity[]): ExternalDataSourceResponse[] {
    return entities.map((e) => ExternalDataSourceMapper.toResponse(e));
  }
}
