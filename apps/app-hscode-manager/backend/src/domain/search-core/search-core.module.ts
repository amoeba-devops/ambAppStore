import { Module } from '@nestjs/common';
import { EmbeddingService } from './service/embedding.service';
import { SemanticRetrievalService } from './service/semantic-retrieval.service';
import { ClarifyingQuestionService } from './service/clarifying-question.service';
import { ResultAssemblerService } from './service/result-assembler.service';

/** 검색 코어 — 임베딩/검색/명확화/결과조립 등 모드 공통 엔진 (FN-001~003). */
@Module({
  providers: [
    EmbeddingService,
    SemanticRetrievalService,
    ClarifyingQuestionService,
    ResultAssemblerService,
  ],
  exports: [
    EmbeddingService,
    SemanticRetrievalService,
    ClarifyingQuestionService,
    ResultAssemblerService,
  ],
})
export class SearchCoreModule {}
