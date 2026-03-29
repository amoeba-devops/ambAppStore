import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface SubscriptionStatus {
  appSlug: string;
  status: string | null;
  subId: string | null;
}

export interface SubscriptionItem {
  subId: string;
  entCode: string;
  entName: string;
  appSlug: string;
  appName: string;
  status: string;
  requestedBy: string;
  requestedEmail: string;
  reason: string;
  rejectReason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function useSubscriptionCheck(appSlug: string, enabled: boolean) {
  return useQuery<SubscriptionStatus>({
    queryKey: ['platform', 'subscriptions', 'check', appSlug],
    queryFn: async () => {
      const res = await apiClient.get(`/v1/platform/subscriptions/check/${appSlug}`);
      return res.data.data;
    },
    enabled: enabled && !!appSlug,
  });
}

export function useMySubscriptions(enabled: boolean) {
  return useQuery<SubscriptionItem[]>({
    queryKey: ['platform', 'subscriptions', 'my'],
    queryFn: async () => {
      const res = await apiClient.get('/v1/platform/subscriptions/my');
      return res.data.data;
    },
    enabled,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { app_slug: string; ent_code: string; ent_name: string; reason?: string }) => {
      const res = await apiClient.post('/v1/platform/subscriptions', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
    },
  });
}

export function useCreatePublicSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      app_slug: string;
      ent_id: string;
      ent_code: string;
      ent_name: string;
      requester_name?: string;
      requester_email?: string;
      reason?: string;
    }) => {
      const res = await apiClient.post('/v1/platform/subscriptions/public', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subId: string) => {
      const res = await apiClient.patch(`/v1/platform/subscriptions/${subId}/cancel`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
    },
  });
}
