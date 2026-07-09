import { apiClient, ApiResponse, unwrap } from '@/lib/api-client';
import type { ChatHistory, ChatSession, Paginated, SendMessageResult } from '@/types/agent.types';

/** Q&A 챗봇 (Phase 3). */
export const chatService = {
  send(message: string, sessionId?: string): Promise<SendMessageResult> {
    return unwrap(
      apiClient.post<ApiResponse<SendMessageResult>>('/chat/messages', {
        message,
        session_id: sessionId,
      }),
    );
  },

  listSessions(page = 1, size = 20): Promise<Paginated<ChatSession>> {
    return unwrap(
      apiClient.get<ApiResponse<Paginated<ChatSession>>>('/chat/sessions', {
        params: { page, size },
      }),
    );
  },

  getMessages(id: string): Promise<ChatHistory> {
    return unwrap(apiClient.get<ApiResponse<ChatHistory>>(`/chat/sessions/${id}`));
  },
};
