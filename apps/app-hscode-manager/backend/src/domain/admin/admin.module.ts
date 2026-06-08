import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { PolicyThresholdEntity } from './entity/policy-threshold.entity';
import { UnsupportedCountryRequestEntity } from './entity/unsupported-country-request.entity';
import { ClassificationEntity } from '../classification/entity/classification.entity';
import { ClassificationCandidateEntity } from '../classification/entity/classification-candidate.entity';
import { VerificationEventEntity } from '../verification/entity/verification-event.entity';
import { AiRecommendationLogEntity } from '../external/entity/ai-recommendation-log.entity';
import { PolicyService } from './service/policy.service';
import { UnsupportedCountryService } from './service/unsupported-country.service';
import { AdminKpiService } from './service/admin-kpi.service';
import { AdminController } from './controller/admin.controller';

/**
 * @Global — PolicyService 가 다른 도메인 (Escalation/Ranker/Internal Matching) 에서 inject 됨.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PolicyThresholdEntity,
      UnsupportedCountryRequestEntity,
      ClassificationEntity,
      ClassificationCandidateEntity,
      VerificationEventEntity,
      AiRecommendationLogEntity,
    ]),
    AuthModule,
  ],
  providers: [PolicyService, UnsupportedCountryService, AdminKpiService],
  controllers: [AdminController],
  exports: [PolicyService, UnsupportedCountryService],
})
export class AdminModule {}
