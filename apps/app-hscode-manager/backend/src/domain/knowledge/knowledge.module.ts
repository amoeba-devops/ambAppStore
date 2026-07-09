import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchCoreModule } from '../search-core/search-core.module';
import { HsCode } from './entity/hs-code.entity';
import { KnowledgeDocument } from './entity/knowledge-document.entity';
import { DocChunk } from './entity/doc-chunk.entity';
import { KnowledgeController } from './controller/knowledge.controller';
import { HsCodeTableService } from './service/hs-code-table.service';
import { ChunkingService } from './service/chunking.service';
import { KnowledgeIngestService } from './service/knowledge-ingest.service';
import { KnowledgeRetrievalService } from './service/knowledge-retrieval.service';

/**
 * 지식/RAG 구축 (Phase 1) — HS 기준표 마스터 + 지식 문서 청킹·임베딩·검색.
 * 통관 에이전트(문서 업로드 매칭·Q&A 챗봇)의 근거 지식 계층. EmbeddingService(TEI/BGE-M3) 재사용.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HsCode, KnowledgeDocument, DocChunk]),
    SearchCoreModule,
  ],
  controllers: [KnowledgeController],
  providers: [
    HsCodeTableService,
    ChunkingService,
    KnowledgeIngestService,
    KnowledgeRetrievalService,
  ],
  exports: [KnowledgeRetrievalService, KnowledgeIngestService],
})
export class KnowledgeModule {}
