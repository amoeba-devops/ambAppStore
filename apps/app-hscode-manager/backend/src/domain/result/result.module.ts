import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryLog } from '../search-qa/entity/query-log.entity';
import { HsReference } from '../reference/entity/hs-reference.entity';
import { ResultController } from './controller/result.controller';
import { ResultService } from './service/result.service';

/** SCR-004 결과 상세 모듈. */
@Module({
  imports: [TypeOrmModule.forFeature([QueryLog, HsReference])],
  controllers: [ResultController],
  providers: [ResultService],
})
export class ResultModule {}
