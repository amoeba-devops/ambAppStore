import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AdminSubscription {
  subId: string;
  entId: string;
  entCode: string;
  entName: string;
  appId: string;
  appSlug: string;
  appName: string;
  status: string;
  requestedBy: string;
  requestedName: string;
  requestedEmail: string;
  reason: string | null;
  rejectReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscriptionListResponse {
  items: AdminSubscription[];
  pagination: { page: number; size: number; totalCount: number; totalPages: number };
}

export interface SubscriptionStats {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  rejected: number;
  cancelled: number;
  expired: number;
  byApp: Array<{ appSlug: string; appName: string; active: number; pending: number; total: number }>;
}

export interface AdminSubscriptionFilters {
  status?: string;
  search?: string;
  app_slug?: string;
  page?: number;
  size?: number;
}

export function useAdminSubscriptions(filters: AdminSubscriptionFilters) {
  return useQuery<AdminSubscriptionListResponse>({
    queryKey: ['admin', 'subscriptions', filters],
    queryFn: async () => {
      const res = await apiClient.get('/v1/admin/subscriptions', { params: filters });
      return res.data.data;
    },
  });
}

export function useAdminSubscriptionDetail(subId: string) {
  return useQuery<AdminSubscription>({
    queryKey: ['admin', 'subscriptions', subId],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/admin/subscriptions/${subId}`);
      return res.data.data;
    },
    enabled: !!subId,
  });
}

export function useSubscriptionStats() {
  return useQuery<SubscriptionStats>({
    queryKey: ['admin', 'subscriptions', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/admin/subscriptions/stats');
      return res.data.data;
    },
  });
}

function useSubscriptionAction(action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subId, body }: { subId: string; body?: Record<string, unknown> }) => {
      const res = await apiClient.patch(`/v1/admin/subscriptions/${subId}/${action}`, body);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
    },
  });
}

export const useApproveSubscription = () => useSubscriptionAction('approve');
export const useRejectSubscription = () => useSubscriptionAction('reject');
export const useSuspendSubscription = () => useSubscriptionAction('suspend');
export const useCancelSubscription = () => useSubscriptionAction('cancel');
export const useReactivateSubscription = () => useSubscriptionAction('reactivate');
