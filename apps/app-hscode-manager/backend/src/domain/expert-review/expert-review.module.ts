import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ExpertReviewEntity } from './entity/expert-review.entity';
import { ExpertKeywordDictionaryEntity } from './entity/expert-keyword-dictionary.entity';
import { ClassificationEntity } from '../classification/entity/classification.entity';
import { ClassificationCandidateEntity } from '../classification/entity/classification-candidate.entity';
import { InquiryEntity } from '../inquiry/entity/inquiry.entity';
import { ItemEntity } from '../item/entity/item.entity';
import { VerificationEventEntity } from '../verification/entity/verification-event.entity';
import { EscalationService } from './service/escalation.service';
import { ExpertReviewService } from './service/expert-review.service';
import { ExpertReviewController } from './controller/expert-review.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpertReviewEntity,
      ExpertKeywordDictionaryEntity,
      ClassificationEntity,
      ClassificationCandidateEntity,
      InquiryEntity,
      ItemEntity,
      VerificationEventEntity,
    ]),
    AuthModule,
  ],
  providers: [EscalationService, ExpertReviewService],
  controllers: [ExpertReviewController],
  exports: [EscalationService, ExpertReviewService],
})
export class ExpertReviewModule {}
