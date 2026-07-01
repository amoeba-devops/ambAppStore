import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewQueue } from './entity/review-queue.entity';
import { GtinHsMap } from '../gtin/entity/gtin-hs-map.entity';
import { AuditModule } from '../audit/audit.module';
import { ReviewController } from './controller/review.controller';
import { ReviewService } from './service/review.service';

/** SCR-005 참조 검토 큐 모듈 (FR-019/018). */
@Module({
  imports: [TypeOrmModule.forFeature([ReviewQueue, GtinHsMap]), AuditModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
