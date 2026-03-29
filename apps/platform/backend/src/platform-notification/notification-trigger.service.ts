import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationType } from './entities/notification.entity';
import { SubscriptionEntity } from '../platform-subscription/entities/subscription.entity';

@Injectable()
export class NotificationTriggerService {
  constructor(private readonly notificationService: NotificationService) {}

  async onSubscriptionApproved(subscription: SubscriptionEntity): Promise<void> {
    const expiresInfo = subscription.subExpiresAt
      ? ` (Expires: ${subscription.subExpiresAt.toISOString().split('T')[0]})`
      : '';

    await this.notificationService.create({
      entId: subscription.entId,
      userId: subscription.subRequestedBy,
      type: NotificationType.SUB_APPROVED,
      title: `App subscription approved`,
      message: `Your subscription for "${subscription.app?.appName || 'App'}" has been approved.${expiresInfo}`,
      refType: 'subscription',
      refId: subscription.subId,
    });
  }

  async onSubscriptionRejected(subscription: SubscriptionEntity): Promise<void> {
    const reasonInfo = subscription.subRejectReason
      ? ` Reason: ${subscription.subRejectReason}`
      : '';

    await this.notificationService.create({
      entId: subscription.entId,
      userId: subscription.subRequestedBy,
      type: NotificationType.SUB_REJECTED,
      title: `App subscription rejected`,
      message: `Your subscription for "${subscription.app?.appName || 'App'}" has been rejected.${reasonInfo}`,
      refType: 'subscription',
      refId: subscription.subId,
    });
  }

  async onSubscriptionSuspended(subscription: SubscriptionEntity): Promise<void> {
    await this.notificationService.create({
      entId: subscription.entId,
      userId: subscription.subRequestedBy,
      type: NotificationType.SUB_SUSPENDED,
      title: `App subscription suspended`,
      message: `Your subscription for "${subscription.app?.appName || 'App'}" has been suspended. Contact admin for details.`,
      refType: 'subscription',
      refId: subscription.subId,
    });
  }

  async onSubscriptionExpired(subscription: SubscriptionEntity): Promise<void> {
    await this.notificationService.create({
      entId: subscription.entId,
      userId: subscription.subRequestedBy,
      type: NotificationType.SUB_EXPIRED,
      title: `App subscription expired`,
      message: `Your subscription for "${subscription.app?.appName || 'App'}" has expired. Please re-apply if needed.`,
      refType: 'subscription',
      refId: subscription.subId,
    });
  }

  async onSubscriptionExpiringSoon(subscription: SubscriptionEntity, daysLeft: number): Promise<void> {
    await this.notificationService.create({
      entId: subscription.entId,
      userId: subscription.subRequestedBy,
      type: NotificationType.SUB_EXPIRING_SOON,
      title: `App subscription expiring soon`,
      message: `Your subscription for "${subscription.app?.appName || 'App'}" will expire in ${daysLeft} day(s).`,
      refType: 'subscription',
      refId: subscription.subId,
    });
  }
}
