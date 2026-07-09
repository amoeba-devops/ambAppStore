import { ChatSession } from '../entity/chat-session.entity';
import { ChatMessage } from '../entity/chat-message.entity';
import {
  ChatMessageResponse,
  ChatSessionResponse,
} from '../dto/response/chat.response';

/** Chat Entity → Response 변환 (static). */
export class ChatMapper {
  static toSessionResponse(s: ChatSession): ChatSessionResponse {
    return {
      chtId: s.chtId,
      title: s.title,
      messageCount: s.messageCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  static toSessionListResponse(rows: ChatSession[]): ChatSessionResponse[] {
    return rows.map((s) => this.toSessionResponse(s));
  }

  static toMessageResponse(m: ChatMessage): ChatMessageResponse {
    return {
      msgId: m.msgId,
      role: m.role,
      content: m.content,
      candidates: m.candidates ?? [],
      citations: m.citations ?? [],
      needQuestion: m.needQuestion,
      source: m.source,
      createdAt: m.createdAt,
    };
  }

  static toMessageListResponse(rows: ChatMessage[]): ChatMessageResponse[] {
    return rows.map((m) => this.toMessageResponse(m));
  }
}
