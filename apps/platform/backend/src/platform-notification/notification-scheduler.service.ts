import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Between } from 'typeorm';
import { SubscriptionEntity, SubscriptionStatus } from '../platform-subscription/entities/subscription.entity';
import { NotificationTriggerService } from './notification-trigger.service';
import { NotificationEntity, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private readonly notificationTriggerService: NotificationTriggerService,
  ) {}

  /**
   * 매일 00:00 UTC — 만료 처리 + 만료 임박 알림
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiration(): Promise<void> {
    this.logger.log('Running subscription expiration check...');

    const now = new Date();

    // Step 1: 만료일이 지난 ACTIVE 구독 → EXPIRED
    const expiredSubs = await this.subscriptionRepository.find({
      where: {
        subStatus: SubscriptionStatus.ACTIVE,
        subExpiresAt: LessThanOrEqual(now),
      },
      relations: ['app'],
    });

    for (const sub of expiredSubs) {
      sub.subStatus = SubscriptionStatus.EXPIRED;
      await this.subscriptionRepository.save(sub);
      await this.notificationTriggerService.onSubscriptionExpired(sub);
      this.logger.log(`Expired subscription: ${sub.subId} (${sub.app?.appName})`);
    }

    // Step 2: 7일 이내 만료 임박 ACTIVE 구독 → 알림 (중복 방지)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSubs = await this.subscriptionRepository.find({
      where: {
        subStatus: SubscriptionStatus.ACTIVE,
        subExpiresAt: Between(now, sevenDaysLater),
      },
      relations: ['app'],
    });

    for (const sub of expiringSubs) {
      // 오늘 이미 SUB_EXPIRING_SOON 알림을 보냈는지 확인
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const existingNotification = await this.notificationRepository
        .createQueryBuilder('ntf')
        .where('ntf.ntf_ref_id = :refId', { refId: sub.subId })
        .andWhere('ntf.ntf_type = :type', { type: NotificationType.SUB_EXPIRING_SOON })
        .andWhere('ntf.ntf_created_at >= :start AND ntf.ntf_created_at < :end', {
          start: todayStart,
          end: todayEnd,
        })
        .getOne();

      if (!existingNotification) {
        const daysLeft = Math.ceil(
          ((sub.subExpiresAt?.getTime() ?? 0) - now.getTime()) / (24 * 60 * 60 * 1000),
        );
        await this.notificationTriggerService.onSubscriptionExpiringSoon(sub, daysLeft);
        this.logger.log(`Expiring soon notification sent: ${sub.subId} (${daysLeft} days left)`);
      }
    }

    this.logger.log(
      `Expiration check complete. Expired: ${expiredSubs.length}, Expiring soon: ${expiringSubs.length}`,
    );
  }
}
