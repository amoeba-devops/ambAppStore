import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchCoreModule } from '../search-core/search-core.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { ChatSession } from './entity/chat-session.entity';
import { ChatMessage } from './entity/chat-message.entity';
import { ChatController } from './controller/chat.controller';
import { ChatService } from './service/chat.service';

/**
 * Q&A 챗봇 (Phase 3, 역할 ①) — 대화형 세션 + RAG 근거 답변.
 * SearchCore(면장 검색) + Knowledge(기준표/지식) + AdminSettings(Claude 키/모델) 재사용.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
    SearchCoreModule,
    KnowledgeModule,
    AdminSettingsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
