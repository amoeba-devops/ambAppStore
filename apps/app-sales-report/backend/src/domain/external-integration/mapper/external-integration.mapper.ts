import { ExternalIntegrationEntity } from '../entity/external-integration.entity';
import { ExternalIntegrationResponse } from '../dto/response/external-integration.response';

export class ExternalIntegrationMapper {
  static toResponse(entity: ExternalIntegrationEntity): ExternalIntegrationResponse {
    return {
      eitId: entity.eitId,
      category: entity.eitCategory,
      serviceCode: entity.eitServiceCode,
      serviceName: entity.eitServiceName,
      endpoint: entity.eitEndpoint,
      keyName: entity.eitKeyName,
      hasKeyValue: !!entity.eitKeyValue,
      extraConfig: entity.eitExtraConfig,
      isActive: entity.eitIsActive,
      lastVerifiedAt: entity.eitLastVerifiedAt?.toISOString() ?? null,
      createdAt: entity.eitCreatedAt.toISOString(),
      updatedAt: entity.eitUpdatedAt.toISOString(),
    };
  }

  static toListResponse(entities: ExternalIntegrationEntity[]): ExternalIntegrationResponse[] {
    return entities.map(this.toResponse);
  }
}
