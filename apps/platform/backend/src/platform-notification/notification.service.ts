import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity, NotificationType } from './entities/notification.entity';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async findByUser(userId: string, entId: string, page = 1, size = 20) {
    const [items, totalCount] = await this.notificationRepository.findAndCount({
      where: { ntfUserId: userId, entId },
      order: { ntfCreatedAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });

    return {
      items,
      pagination: {
        page,
        size,
        totalCount,
        totalPages: Math.ceil(totalCount / size),
      },
    };
  }

  async getUnreadCount(userId: string, entId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { ntfUserId: userId, entId, ntfIsRead: 0 },
    });
  }

  async markAsRead(ntfId: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { ntfId, ntfUserId: userId },
    });
    if (!notification) {
      throw new BusinessException('PLT-E4003', 'Notification not found', HttpStatus.NOT_FOUND);
    }

    notification.ntfIsRead = 1;
    notification.ntfReadAt = new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string, entId: string): Promise<void> {
    await this.notificationRepository
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ ntfIsRead: 1, ntfReadAt: new Date() })
      .where('ntf_user_id = :userId AND ent_id = :entId AND ntf_is_read = 0', { userId, entId })
      .execute();
  }

  async create(data: {
    entId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    refType?: string;
    refId?: string;
  }): Promise<NotificationEntity> {
    const notification = this.notificationRepository.create({
      entId: data.entId,
      ntfUserId: data.userId,
      ntfType: data.type,
      ntfTitle: data.title,
      ntfMessage: data.message,
      ntfRefType: data.refType,
      ntfRefId: data.refId,
    });
    return this.notificationRepository.save(notification);
  }
}
