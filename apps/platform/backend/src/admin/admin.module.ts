import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from '../platform-subscription/entities/subscription.entity';
import { AppEntity } from '../platform-app/entities/app.entity';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminSubscriptionController } from './admin-subscription.controller';
import { AdminAppService } from './admin-app.service';
import { AdminAppController } from './admin-app.controller';
import { PlatformAppModule } from '../platform-app/app.module';
import { NotificationModule } from '../platform-notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionEntity, AppEntity]),
    PlatformAppModule,
    NotificationModule,
  ],
  controllers: [AdminSubscriptionController, AdminAppController],
  providers: [AdminSubscriptionService, AdminAppService],
})
export class AdminModule {}
