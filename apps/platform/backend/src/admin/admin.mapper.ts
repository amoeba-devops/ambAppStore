import { SubscriptionEntity } from '../platform-subscription/entities/subscription.entity';
import { AppEntity } from '../platform-app/entities/app.entity';
import { AdminSubscriptionResponse } from './dto/response/admin-subscription.response';
import { AdminAppResponse } from './dto/response/admin-app.response';

export class AdminMapper {
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
