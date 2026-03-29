import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationTriggerService } from './notification-trigger.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { SubscriptionEntity } from '../platform-subscription/entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, SubscriptionEntity])],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationTriggerService, NotificationSchedulerService],
  exports: [NotificationService, NotificationTriggerService],
})
export class NotificationModule {}
