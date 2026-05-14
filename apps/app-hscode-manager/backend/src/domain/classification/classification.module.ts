import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ClassificationEntity } from './entity/classification.entity';
import { ClassificationCandidateEntity } from './entity/classification-candidate.entity';
import { InquiryEntity } from '../inquiry/entity/inquiry.entity';
import { ItemEntity } from '../item/entity/item.entity';
import { ExporterEntity } from '../master-exporter/entity/exporter.entity';
import { ClassificationService } from './service/classification.service';
import { ResponseFormService } from './service/response-form.service';
import { ClassificationController } from './controller/classification.controller';
import { ExpertReviewModule } from '../expert-review/expert-review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassificationEntity,
      ClassificationCandidateEntity,
      InquiryEntity,
      ItemEntity,
      ExporterEntity,
    ]),
    AuthModule,
    forwardRef(() => ExpertReviewModule),
  ],
  providers: [ClassificationService, ResponseFormService],
  controllers: [ClassificationController],
  exports: [ClassificationService],
})
export class ClassificationModule {}
