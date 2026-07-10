import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { KbCategory } from './entity/kb-category.entity';
import { KbPost } from './entity/kb-post.entity';
import { KbPostTranslation } from './entity/kb-post-translation.entity';
import { KbAttachment } from './entity/kb-attachment.entity';
import { KbDashboardBlock } from './entity/kb-dashboard-block.entity';
import { KbTag } from './entity/kb-tag.entity';
import { KbPostTag } from './entity/kb-post-tag.entity';
import { KbCategoryController } from './controller/kb-category.controller';
import { KbPostController } from './controller/kb-post.controller';
import { KbDashboardController } from './controller/kb-dashboard.controller';
import { KbAttachmentController } from './controller/kb-attachment.controller';
import { KbTagController } from './controller/kb-tag.controller';
import { KbCategoryService } from './service/kb-category.service';
import { KbPostService } from './service/kb-post.service';
import { KbDashboardService } from './service/kb-dashboard.service';
import { KbAttachmentService } from './service/kb-attachment.service';
import { KbTranslationService } from './service/kb-translation.service';
import { KbTagService } from './service/kb-tag.service';

/**
 * 지식창고(Knowledge Base) — 게시판형 참조 라이브러리 + 관리자 편집형 대시보드.
 * 전 테넌트 공용(ent_id NULL): 읽기 @Auth(), 쓰기 @SuperAdminOnly().
 * RAG 승격(FR-KB-014)은 KnowledgeModule의 KnowledgeIngestService 경유(도메인 격리 §2.2).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      KbCategory,
      KbPost,
      KbPostTranslation,
      KbAttachment,
      KbDashboardBlock,
      KbTag,
      KbPostTag,
    ]),
    KnowledgeModule,
    AdminSettingsModule,
  ],
  controllers: [
    KbCategoryController,
    KbPostController,
    KbDashboardController,
    KbAttachmentController,
    KbTagController,
  ],
  providers: [
    KbCategoryService,
    KbPostService,
    KbDashboardService,
    KbAttachmentService,
    KbTranslationService,
    KbTagService,
  ],
})
export class KnowledgeBaseModule {}
