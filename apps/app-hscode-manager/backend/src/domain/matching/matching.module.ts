import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchCoreModule } from '../search-core/search-core.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ReferenceModule } from '../reference/reference.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { MatchRequest } from './entity/match-request.entity';
import { Item } from './entity/item.entity';
import { Recommendation } from './entity/recommendation.entity';
import { MatchingController } from './controller/matching.controller';
import { MatchingService } from './service/matching.service';
import { DocumentParserService } from './service/document-parser.service';

/**
 * 문서 업로드 매칭 (Phase 2, 주 기능) — 자유양식 파싱 + 품목별 RAG 매칭 + 승인/저장.
 * SearchCore(면장 검색·AI분류) + Knowledge(기준표/지식) + Reference(확정 재저장) 재사용.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MatchRequest, Item, Recommendation]),
    SearchCoreModule,
    KnowledgeModule,
    ReferenceModule,
    AdminSettingsModule, // AppConfigService(문서 파서 AI 컬럼추론 키/모델)
  ],
  controllers: [MatchingController],
  providers: [MatchingService, DocumentParserService],
  exports: [MatchingService],
})
export class MatchingModule {}
