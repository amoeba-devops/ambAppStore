import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { VerificationEventEntity } from './entity/verification-event.entity';
import { ReviewQueueEntity } from './entity/review-queue.entity';
import { ClassificationEntity } from '../classification/entity/classification.entity';
import { ItemEntity } from '../item/entity/item.entity';
import { VerificationService } from './service/verification.service';
import { KpiService } from './service/kpi.service';
import { VerificationController } from './controller/verification.controller';
import { ExpertReviewModule } from '../expert-review/expert-review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerificationEventEntity,
      ReviewQueueEntity,
      ClassificationEntity,
      ItemEntity,
    ]),
    AuthModule,
    forwardRef(() => ExpertReviewModule),
  ],
  providers: [VerificationService, KpiService],
  controllers: [VerificationController],
  exports: [VerificationService],
})
export class VerificationModule {}
