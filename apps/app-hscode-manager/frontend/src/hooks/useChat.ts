import { useMutation, useQuery } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';

export function useChatSend() {
  return useMutation({
    mutationFn: (vars: { message: string; sessionId?: string }) =>
      chatService.send(vars.message, vars.sessionId),
  });
}

export function useChatSessions(page = 1, size = 20) {
  return useQuery({
    queryKey: ['chat-sessions', page, size],
    queryFn: () => chatService.listSessions(page, size),
  });
}

export function useChatHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['chat-history', id],
    queryFn: () => chatService.getMessages(id as string),
    enabled: !!id,
  });
}
