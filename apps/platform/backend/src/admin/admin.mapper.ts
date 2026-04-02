import { SubscriptionEntity } from '../platform-subscription/entities/subscription.entity';
import { AppEntity } from '../platform-app/entities/app.entity';
import { AdminIntegrationEntity } from './entity/admin-integration.entity';
import { AdminSubscriptionResponse } from './dto/response/admin-subscription.response';
import { AdminAppResponse } from './dto/response/admin-app.response';
import { AdminIntegrationResponse } from './dto/response/admin-integration.response';

export class AdminMapper {
  static toIntegrationResponse(entity: AdminIntegrationEntity): AdminIntegrationResponse {
    return {
      peiId: entity.peiId,
      entId: entity.entId,
      category: entity.peiCategory,
      serviceCode: entity.peiServiceCode,
      serviceName: entity.peiServiceName,
      endpoint: entity.peiEndpoint,
      keyName: entity.peiKeyName,
      hasKeyValue: !!entity.peiKeyValue,
      extraConfig: entity.peiExtraConfig,
      isActive: entity.peiIsActive,
      lastVerifiedAt: entity.peiLastVerifiedAt?.toISOString() || null,
      createdAt: entity.peiCreatedAt.toISOString(),
      updatedAt: entity.peiUpdatedAt.toISOString(),
    };
  }

  static toSubscriptionResponse(entity: SubscriptionEntity): AdminSubscriptionResponse {
    return {
      subId: entity.subId,
      entId: entity.entId,
      entCode: entity.entCode,
      entName: entity.entName,
      appId: entity.appId,
      appSlug: entity.app?.appSlug || '',
      appName: entity.app?.appName || '',
      status: entity.subStatus,
      requestedBy: entity.subRequestedBy,
      requestedName: entity.subRequestedName,
      requestedEmail: entity.subRequestedEmail,
      reason: entity.subReason,
      rejectReason: entity.subRejectReason,
      approvedBy: entity.subApprovedBy,
      approvedAt: entity.subApprovedAt?.toISOString() || null,
      expiresAt: entity.subExpiresAt?.toISOString() || null,
      createdAt: entity.subCreatedAt.toISOString(),
      updatedAt: entity.subUpdatedAt.toISOString(),
    };
  }

  static toAppResponse(entity: AppEntity): AdminAppResponse {
    return {
      appId: entity.appId,
      slug: entity.appSlug,
      name: entity.appName,
      nameEn: entity.appNameEn,
      shortDesc: entity.appShortDesc,
      description: entity.appDescription,
      iconUrl: entity.appIconUrl,
      screenshots: entity.appScreenshots || [],
      features: entity.appFeatures || [],
      category: entity.appCategory,
      status: entity.appStatus,
      sortOrder: entity.appSortOrder,
      portFe: entity.appPortFe,
      portBe: entity.appPortBe,
      createdAt: entity.appCreatedAt.toISOString(),
      updatedAt: entity.appUpdatedAt.toISOString(),
    };
  }
}
