import { Module } from '@nestjs/common';
import { EmbeddingService } from './service/embedding.service';
import { SemanticRetrievalService } from './service/semantic-retrieval.service';
import { ClarifyingQuestionService } from './service/clarifying-question.service';
import { ResultAssemblerService } from './service/result-assembler.service';
import { AiClassificationService } from './service/ai-classification.service';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

/** 검색 코어 — 임베딩/검색/명확화/AI분류/결과조립 등 모드 공통 엔진 (FN-001~003). */
@Module({
  imports: [AdminSettingsModule], // AppConfigService(설정 AI 키/모델)
  providers: [
    EmbeddingService,
    SemanticRetrievalService,
    ClarifyingQuestionService,
    ResultAssemblerService,
    AiClassificationService,
  ],
  exports: [
    EmbeddingService,
    SemanticRetrievalService,
    ClarifyingQuestionService,
    ResultAssemblerService,
    AiClassificationService,
  ],
})
export class SearchCoreModule {}
