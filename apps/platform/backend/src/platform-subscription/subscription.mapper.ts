import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionResponse, SubscriptionStatusResponse } from './dto/response/subscription.response';
import { AppEntity } from '../platform-app/entities/app.entity';

export class SubscriptionMapper {
  static toResponse(entity: SubscriptionEntity, app?: AppEntity): SubscriptionResponse {
    return {
      subId: entity.subId,
      entCode: entity.entCode,
      entName: entity.entName,
      appSlug: app?.appSlug || '',
      appName: app?.appName || '',
      status: entity.subStatus,
      requestedBy: entity.subRequestedName,
      requestedEmail: entity.subRequestedEmail,
      reason: entity.subReason,
      createdAt: entity.subCreatedAt.toISOString(),
    };
  }

  static toListResponse(entities: SubscriptionEntity[]): SubscriptionResponse[] {
    return entities.map((e) => SubscriptionMapper.toResponse(e, e.app));
  }

  static toStatusResponse(appSlug: string, entity?: SubscriptionEntity): SubscriptionStatusResponse {
    return {
      appSlug,
      status: entity?.subStatus || null,
      subId: entity?.subId || null,
    };
  }
}
