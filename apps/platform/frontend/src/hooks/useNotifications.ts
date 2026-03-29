import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface NotificationItem {
  ntfId: string;
  type: string;
  title: string;
  message: string;
  refType: string | null;
  refId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  size: number;
}

interface UnreadCountResponse {
  count: number;
}

export function useNotifications(page = 1, size = 20, enabled = true) {
  return useQuery<NotificationListResponse>({
    queryKey: ['platform', 'notifications', page, size],
    queryFn: async () => {
      const res = await apiClient.get('/v1/platform/notifications', {
        params: { page, size },
      });
      return res.data.data;
    },
    enabled,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery<UnreadCountResponse>({
    queryKey: ['platform', 'notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/platform/notifications/unread-count');
      return res.data.data;
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ntfId: string) => {
      const res = await apiClient.patch(`/v1/platform/notifications/${ntfId}/read`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch('/v1/platform/notifications/read-all');
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'notifications'] });
    },
  });
}
