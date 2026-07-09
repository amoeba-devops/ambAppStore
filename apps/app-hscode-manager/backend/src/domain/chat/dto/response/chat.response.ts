import { MessageCandidate, MessageCitation } from '../../entity/chat-message.entity';

/** 대화 메시지 응답 (camelCase). */
export class ChatMessageResponse {
  msgId: string;
  role: string; // USER/ASSISTANT
  content: string;
  candidates: MessageCandidate[];
  citations: MessageCitation[];
  needQuestion: boolean;
  source: string | null;
  createdAt: Date;
}

/** 세션 요약 응답. */
export class ChatSessionResponse {
  chtId: string;
  title: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 메시지 전송 응답 — 세션 + 사용자/어시스턴트 메시지. */
export class SendMessageResponse {
  session: ChatSessionResponse;
  userMessage: ChatMessageResponse;
  assistantMessage: ChatMessageResponse;
}

/** 세션 메시지 이력 응답. */
export class ChatHistoryResponse {
  session: ChatSessionResponse;
  messages: ChatMessageResponse[];
}
