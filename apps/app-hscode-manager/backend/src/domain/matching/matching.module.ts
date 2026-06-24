import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ItemEntity } from '../item/entity/item.entity';
import { InquiryEntity } from '../inquiry/entity/inquiry.entity';
import { ClassificationEntity } from '../classification/entity/classification.entity';
import { MasterFtaModule } from '../master-fta/master-fta.module';
import { ExternalModule } from '../external/external.module';
import { InternalMatchingService } from './service/internal-matching.service';
import { RankerService } from './service/ranker.service';
import { MatchingService } from './service/matching.service';
import { MatchingController } from './controller/matching.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ItemEntity, InquiryEntity, ClassificationEntity]),
    AuthModule,
    MasterFtaModule,
    ExternalModule,
  ],
  providers: [InternalMatchingService, RankerService, MatchingService],
  controllers: [MatchingController],
  exports: [MatchingService],
})
export class MatchingModule {}
