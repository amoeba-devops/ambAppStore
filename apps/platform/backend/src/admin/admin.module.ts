import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from '../platform-subscription/entities/subscription.entity';
import { AppEntity } from '../platform-app/entities/app.entity';
import { AdminIntegrationEntity } from './entity/admin-integration.entity';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminSubscriptionController } from './admin-subscription.controller';
import { AdminAppService } from './admin-app.service';
import { AdminAppController } from './admin-app.controller';
import { AdminIntegrationService } from './admin-integration.service';
import { AdminIntegrationController } from './admin-integration.controller';
import { PlatformAppModule } from '../platform-app/app.module';
import { NotificationModule } from '../platform-notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionEntity, AppEntity, AdminIntegrationEntity]),
    PlatformAppModule,
    NotificationModule,
  ],
  controllers: [AdminSubscriptionController, AdminAppController, AdminIntegrationController],
  providers: [AdminSubscriptionService, AdminAppService, AdminIntegrationService],
})
export class AdminModule {}
