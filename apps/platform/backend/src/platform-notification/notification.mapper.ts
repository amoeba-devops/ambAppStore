import { NotificationEntity } from './entities/notification.entity';
import { NotificationResponse } from './dto/notification.response';

export class NotificationMapper {
  static toResponse(entity: NotificationEntity): NotificationResponse {
    return {
      ntfId: entity.ntfId,
      type: entity.ntfType,
      title: entity.ntfTitle,
      message: entity.ntfMessage,
      refType: entity.ntfRefType || null,
      refId: entity.ntfRefId || null,
      isRead: entity.ntfIsRead === 1,
      readAt: entity.ntfReadAt?.toISOString() || null,
      createdAt: entity.ntfCreatedAt.toISOString(),
    };
  }

  static toListResponse(entities: NotificationEntity[]): NotificationResponse[] {
    return entities.map((e) => NotificationMapper.toResponse(e));
  }
}
