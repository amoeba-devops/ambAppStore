import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryLog } from './entity/query-log.entity';
import { QaController } from './controller/qa.controller';
import { QaService } from './service/qa.service';
import { SearchCoreModule } from '../search-core/search-core.module';
import { AuditModule } from '../audit/audit.module';

/** SCR-001 Q&A 검색 모듈 (FR-001~007, FN-001~003). */
@Module({
  imports: [TypeOrmModule.forFeature([QueryLog]), SearchCoreModule, AuditModule],
  controllers: [QaController],
  providers: [QaService],
})
export class SearchQaModule {}
