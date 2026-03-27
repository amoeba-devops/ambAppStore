import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PlatformAppModule } from '../platform-app/app.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionEntity]),
    PlatformAppModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class PlatformSubscriptionModule {}
